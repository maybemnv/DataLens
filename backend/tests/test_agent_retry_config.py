"""Tests for the agent's LLM client retry configuration.

The Groq client (groq._base_client) has its own internal retry logic that
runs in addition to the agent's tenacity retry. If both fire, the request
can take 100+ seconds before failing — well past the WebSocket timeout.

These tests verify the agent pins max_retries=0 on the Groq client so
we rely on tenacity alone (faster, more predictable).
"""
import inspect

from backend.agent.analyst_agent import _get_or_create_executor


def test_llm_has_zero_internal_retries():
    """The ChatGroq client must have max_retries=0 so the Groq client
    doesn't stack its own retries on top of tenacity's."""
    from langchain_groq import ChatGroq

    executor = _get_or_create_executor("test-session-no-retries")
    agent = executor.agent

    # `create_react_agent` exposes the LLM as `agent.llm` in older versions
    # and as a runnable chain in newer ones. Try the well-known path first.
    candidate = None
    for attr in ("llm", "llm_chain", "runnable"):
        if hasattr(agent, attr):
            candidate = getattr(agent, attr)
            if isinstance(candidate, ChatGroq):
                break
            # If runnable is a chain, the LLM is one step inside
            if attr == "runnable" and hasattr(candidate, "steps"):
                for step in candidate.steps:
                    if isinstance(step, ChatGroq):
                        candidate = step
                        break

    # Clean up
    from backend.agent.analyst_agent import _executor_cache
    _executor_cache.pop("test-session-no-retries", None)

    if not isinstance(candidate, ChatGroq):
        # Fall back to source-level check (less ideal but reliable)
        import inspect
        from backend.agent import analyst_agent
        src = inspect.getsource(analyst_agent._get_or_create_executor)
        assert "max_retries=0" in src, (
            "Could not find ChatGroq instance and source check for "
            "`max_retries=0` also failed. Add it to ChatGroq(...) in "
            "_get_or_create_executor."
        )
        return  # Source check passed

    assert candidate.max_retries == 0, (
        f"ChatGroq max_retries={candidate.max_retries}, expected 0. "
        "Without this, Groq's internal retries stack on top of tenacity."
    )


def test_invoke_tenacity_retries_no_more_than_twice():
    """Tenacity should stop after at most 2 attempts to keep total time
    under the WebSocket timeout."""
    from backend.agent import analyst_agent
    src = inspect.getsource(analyst_agent._invoke)
    assert "stop_after_attempt(2)" in src, (
        "Tenacity stop_after_attempt should be 2 (not 3) to fail fast."
    )
    assert "max=4" in src, "Tenacity wait_exponential max should be 4s."
