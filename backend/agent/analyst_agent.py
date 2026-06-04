from __future__ import annotations

import asyncio
import logging
import time

import groq
from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)
from langchain_groq import ChatGroq
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.exceptions import OutputParserException
from langchain_core.prompts import PromptTemplate

from ..config import settings
from ..tools import ALL_TOOLS


logger = logging.getLogger(__name__)

AGENT_TIMEOUT_SECONDS = 120

# ─── Executor cache: one per session ─────────────────────────────────
# Reuses the LLM + agent executor across requests for the same session.
# Avoids the 2-3 second cold-start penalty of creating a new executor
# on every message. Evicted after 10 minutes of inactivity.
_executor_cache: dict[str, tuple[AgentExecutor, float]] = {}
_EXECUTOR_TTL_SECONDS = 600  # 10 minutes


def _evict_stale_executors() -> None:
    """Remove executors that haven't been used recently."""
    now = time.monotonic()
    stale = [sid for sid, (_, last_used) in _executor_cache.items() if now - last_used > _EXECUTOR_TTL_SECONDS]
    for sid in stale:
        del _executor_cache[sid]
        logger.debug(f"Evicted stale executor for session: {sid}")


def _get_or_create_executor(session_id: str) -> AgentExecutor:
    """Get cached executor or create a new one. Evicts stale entries."""
    _evict_stale_executors()

    if session_id in _executor_cache:
        executor, _ = _executor_cache[session_id]
        _executor_cache[session_id] = (executor, time.monotonic())
        return executor

    llm = ChatGroq(
        model=settings.model_name,
        groq_api_key=settings.groq_api_key,
        streaming=True,
        temperature=0,
        max_retries=1,
    )
    prompt = PromptTemplate(
        template=_SYSTEM_PROMPT,
        input_variables=["tools", "tool_names", "input", "agent_scratchpad"],
        partial_variables={"session_id": session_id, "tool_guide": _TOOL_GUIDE},
    )
    agent = create_react_agent(llm, ALL_TOOLS, prompt)
    executor = AgentExecutor(
        agent=agent,
        tools=ALL_TOOLS,
        verbose=False,
        max_iterations=12,
        early_stopping_method="generate",
        handle_parsing_errors=True,
        return_intermediate_steps=True,
    )

    _executor_cache[session_id] = (executor, time.monotonic())
    logger.debug(f"Created new executor for session: {session_id}")
    return executor


_TOOL_GUIDE = """\
Tool selection guide — use the FIRST matching rule:
  Question about schema, columns, data types, or sample rows → describe_dataset
  Means, std, min, max, quartiles for numeric columns → descriptive_stats
  Sums or averages broken down by a category → group_by_stats
  Relationships or correlations between columns → correlation_matrix
  Most common or frequent values in a column → value_counts
  Outliers or anomalies in numeric data → outliers_summary, detect_anomalies
  Reduce dimensions or find structure → run_pca
  Group rows into clusters → run_kmeans
  Cluster with unknown K or noisy data → run_hdbscan
  Visualise high-dimensional data in 2D/3D → run_umap
  Explain model predictions or feature importance → run_shap
  Predict a numeric value → run_regression
  Predict a category → run_classification
  Trend, seasonality, or stationarity of a time series → check_stationarity, decompose_time_series
  Future values of a time series → run_forecast
  Any chart or visualisation request → generate_chart_spec\
"""

_SYSTEM_PROMPT = """\
You are DataLens AI, an autonomous data analyst agent.

Session ID (pass this exact value as session_id in every tool call): {session_id}

{tool_guide}

Available tools: {tools}
Tool names: {tool_names}

Rules:
- ALWAYS call describe_dataset first on any new query.
- NEVER invent a session_id — use the one above.
- NEVER wrap the Action Input JSON in quotes or markdown code blocks.
- NEVER nest all parameters inside the session_id string; provide them as separate JSON keys.
- Chain tools until you have concrete numbers; never skip to conclusions.
- Include a generate_chart_spec call whenever a chart would aid understanding.
- Report tool errors clearly; do not fabricate data.

Response style:
- Be concise. Answer in 1-3 sentences maximum.
- Lead with the key finding or number.
- Do NOT list every column or repeat dataset shape unless asked.
- Do NOT explain basic statistics unless specifically asked.
- Do NOT ask follow-up questions in your answer — just answer.
- Use bullet points only when listing 3+ distinct items.
- Skip phrases like "The dataset has been described" or "Would you like to explore" — just state facts.

Use this format exactly:
Question: the input question
Thought: reasoning and which tool to call next
Action: tool_name
Action Input: {{"session_id": "{session_id}", "param": "value"}}
Observation: tool result
...(repeat Thought/Action/Observation)
Thought: I now have enough information to answer.
Final Answer: precise, complete answer with all key numbers

Question: {input}
Thought: {agent_scratchpad}\
"""


def _is_token_limit_error(exc: BaseException) -> bool:
    if isinstance(exc, groq.APIStatusError) and exc.status_code == 413:
        return True
    if isinstance(exc, groq.RateLimitError):
        msg = str(exc).lower()
        if "request too large" in msg or "413" in msg:
            return True
    return False


def _is_retryable(exc: BaseException) -> bool:
    if _is_token_limit_error(exc):
        return False
    if isinstance(exc, OutputParserException):
        return True
    if isinstance(exc, groq.RateLimitError):
        return True
    if isinstance(exc, groq.APIConnectionError):
        return True
    return False


@retry(
    retry=retry_if_exception(_is_retryable),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    reraise=True,
)
async def _invoke(executor: AgentExecutor, payload: dict, callback=None) -> dict:
    config = {"callbacks": [callback]} if callback else {}
    return await executor.ainvoke(payload, config=config)


# ─── Rate limiting ───────────────────────────────────────────────────
# Prevents overwhelming the Groq API. Each session is limited to
# MAX_REQUESTS_PER_WINDOW concurrent requests.
_RATE_LIMIT_LOCKS: dict[str, asyncio.Semaphore] = {}
MAX_REQUESTS_PER_WINDOW = 3  # max 3 concurrent agent runs per session


def _get_rate_limiter(session_id: str) -> asyncio.Semaphore:
    if session_id not in _RATE_LIMIT_LOCKS:
        _RATE_LIMIT_LOCKS[session_id] = asyncio.Semaphore(MAX_REQUESTS_PER_WINDOW)
    return _RATE_LIMIT_LOCKS[session_id]


async def run_agent(session_id: str, message: str, context: str = "", callback=None) -> dict:
    logger.info(f"Agent run started: session_id={session_id}, message={message[:50]}...")

    executor = _get_or_create_executor(session_id)

    input_text = message
    if context:
        input_text = f"Previous conversation summary:\n{context}\n\nCurrent question: {message}"

    # Acquire rate limit slot
    limiter = _get_rate_limiter(session_id)

    try:
        async with limiter:
            result = await asyncio.wait_for(
                _invoke(executor, {"input": input_text}, callback=callback),
                timeout=AGENT_TIMEOUT_SECONDS,
            )
            logger.info(
                f"Agent run completed: session_id={session_id}, "
                f"steps={len(result.get('intermediate_steps', []))}"
            )
            return result

    except asyncio.TimeoutError:
        logger.error(f"Agent timed out after {AGENT_TIMEOUT_SECONDS}s: session_id={session_id}")
        return {
            "output": f"Analysis timed out after {AGENT_TIMEOUT_SECONDS} seconds. Try a simpler query or smaller dataset.",
            "intermediate_steps": [],
        }

    except groq.RateLimitError as e:
        if _is_token_limit_error(e):
            logger.error(f"Token limit exceeded (rate_limit): session_id={session_id}")
            return {
                "output": (
                    "Request exceeds the model's token limit. "
                    "Try a more specific question or upload a smaller dataset."
                ),
                "intermediate_steps": [],
            }
        logger.error(f"Rate limited: session_id={session_id}")
        return {"output": "Rate limited by the API. Please wait a moment and try again.", "intermediate_steps": []}

    except groq.APIConnectionError:
        logger.error(f"Connection to Groq API failed: session_id={session_id}")
        return {"output": "Could not connect to the AI service. Please try again.", "intermediate_steps": []}

    except groq.APIStatusError as e:
        if e.status_code == 413:
            logger.error(f"Token limit exceeded: session_id={session_id}")
            return {
                "output": (
                    "Request exceeds the model's token limit. "
                    "Try a more specific question or upload a smaller dataset."
                ),
                "intermediate_steps": [],
            }
        logger.exception(f"Groq API error (HTTP {e.status_code}): session_id={session_id}")
        return {"output": f"API error (HTTP {e.status_code}): {e}", "intermediate_steps": []}

    except OutputParserException as e:
        logger.error(f"Agent parse error: session_id={session_id}, error={e}")
        return {
            "output": f"The agent failed to produce a valid response. Details: {e}",
            "intermediate_steps": [],
        }

    except Exception as e:
        logger.exception(f"Agent runtime error: session_id={session_id}, error={e}")
        return {"output": f"An unexpected error occurred: {e}", "intermediate_steps": []}
