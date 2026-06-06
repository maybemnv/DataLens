import asyncio
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..auth import get_current_user
from ..db import get_db, get_redis, get_db_dependency
from ..db.models import Message, ToolRun, Chart, Session as SessionModel, User
from ..session import get_session as get_session_data, refresh_session_ttl
from ..agent.analyst_agent import run_agent
from ..agent.output_parser import parse_output
from ..streaming import WebSocketStreamingCallback
from ..schemas import ChatRequest, ChatResponse
from ..utils.json_utils import sanitize_for_json


logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

# ─── Input validation limits ─────────────────────────────────────────
# Prevent abuse: limit message length to avoid prompt injection and
# context window explosions.
MAX_MESSAGE_LENGTH = 4000  # characters
MAX_KEEPALIVE_INTERVAL = 20  # seconds


async def _keepalive(ws: WebSocket, interval: float = MAX_KEEPALIVE_INTERVAL) -> None:
    try:
        while True:
            await asyncio.sleep(interval)
            await ws.send_text(json.dumps({"type": "ping"}))
    except (WebSocketDisconnect, RuntimeError, Exception):
        pass


async def _run_with_keepalive(ws: WebSocket, coro):
    task = asyncio.create_task(_keepalive(ws))
    try:
        return await coro
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

LLM_CONTEXT_MESSAGES = 10


async def _verify_session_ownership(session_id: str, user_id: int, db: AsyncSession) -> bool:
    result = await db.execute(
        select(SessionModel).where(
            SessionModel.session_id == session_id,
            SessionModel.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


def _validate_message(message: str) -> str:
    """Validate and sanitize user message. Raises HTTPException on invalid input."""
    if not message or not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(message) > MAX_MESSAGE_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Message too long ({len(message)} chars). Maximum is {MAX_MESSAGE_LENGTH} characters."
        )

    # Strip null bytes and control characters (common injection vector)
    cleaned = "".join(c for c in message if ord(c) >= 32 or c in "\n\t\r")
    return cleaned.strip()


async def save_message(
    session_id: str,
    role: str,
    content: str,
    tool_name: Optional[str] = None,
    tool_input: Optional[dict] = None,
    tool_result: Optional[dict] = None,
    db: AsyncSession = None,
) -> None:
    if db is None:
        return

    safe_tool_name = str(tool_name)[:128] if tool_name else None

    try:
        message = Message(
            session_id=session_id,
            role=role,
            content=content,
            tool_name=safe_tool_name,
            tool_input=sanitize_for_json(tool_input) if isinstance(tool_input, dict) else tool_input,
            tool_result=sanitize_for_json(tool_result) if isinstance(tool_result, dict) else tool_result,
        )
        db.add(message)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist message (session {session_id}): {e}")
        try:
            await db.rollback()
        except Exception:
            pass


async def save_tool_run(
    session_id: str,
    tool_name: str,
    tool_input: dict,
    tool_result: dict,
    duration_ms: int,
    db: AsyncSession = None,
) -> None:
    if db is None:
        return

    # Defensive: malformed LLM output can produce non-string tool names.
    # Coerce to string and cap at 128 chars to match the column constraint.
    safe_tool_name = str(tool_name)[:128] if tool_name else "unknown"

    try:
        tool_run = ToolRun(
            session_id=session_id,
            tool_name=safe_tool_name,
            input_json=sanitize_for_json(tool_input),
            result_json=sanitize_for_json(tool_result),
            duration_ms=duration_ms,
        )
        db.add(tool_run)
        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to persist tool_run (session {session_id}, tool={safe_tool_name[:40]}): {e}")
        try:
            await db.rollback()
        except Exception:
            pass


async def save_chart(
    session_id: str,
    chart_type: str,
    vega_spec: dict,
    query: str,
    db: AsyncSession = None,
) -> None:
    if db is None:
        return

    chart = Chart(
        session_id=session_id,
        chart_type=chart_type,
        vega_spec=sanitize_for_json(vega_spec),
        query=query,
    )
    db.add(chart)
    await db.commit()


async def get_conversation_summary(session_id: str, db: AsyncSession) -> str:
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.desc())
        .limit(LLM_CONTEXT_MESSAGES)
    )
    messages = result.scalars().all()

    if not messages:
        return "No previous conversation."

    summary_parts = []
    for msg in reversed(messages):
        if msg.role == "user":
            summary_parts.append(f"User: {msg.content[:200]}")
        elif msg.role == "assistant" and msg.content:
            summary_parts.append(f"Assistant: {msg.content[:200]}")

    return "\n".join(summary_parts)


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
) -> None:
    from jose import JWTError

    token = websocket.query_params.get("token")
    if not token:
        await websocket.send_text(json.dumps({"type": "error", "message": "Missing token"}))
        await websocket.close(code=4001, reason="Missing token")
        return

    from ..auth import jwt
    from ..config import settings as app_settings

    try:
        payload = jwt.decode(token, app_settings.jwt_secret_key, algorithms=[app_settings.jwt_algorithm])
        user_id = int(payload.get("sub"))
        if user_id is None:
            await websocket.send_text(json.dumps({"type": "error", "message": "Invalid token"}))
            await websocket.close(code=4001, reason="Invalid token")
            return
    except JWTError:
        await websocket.send_text(json.dumps({"type": "error", "message": "Invalid token"}))
        await websocket.close(code=4001, reason="Invalid token")
        return

    await websocket.accept()

    async with get_db() as db:
        if not await _verify_session_ownership(session_id, user_id, db):
            await websocket.send_text(json.dumps({"type": "error", "message": "Session not found"}))
            await websocket.close(code=4004, reason="Session not found")
            return

        session = await get_session_data(session_id, db)
        if session is None:
            logger.warning(f"WebSocket rejected: session not found: {session_id}")
            await websocket.send_text(json.dumps({"type": "error", "message": "Session not found"}))
            await websocket.close(code=4004, reason="Session not found")
            return

        await refresh_session_ttl(session_id, db)

        logger.info(f"WebSocket accepted: session_id={session_id}")

        try:
            redis = await get_redis()
            await redis.register_ws(session_id, "websocket")
        except Exception as e:
            logger.warning(f"Failed to register WebSocket in Redis for session {session_id}: {e}")

        callback = WebSocketStreamingCallback(websocket)

        try:
            summary = await get_conversation_summary(session_id, db)

            while True:
                raw = await websocket.receive_text()
                try:
                    data = json.loads(raw)
                    message = data.get("message", "")
                except json.JSONDecodeError:
                    message = raw

                # Skip empty messages (can happen on reconnect)
                if not message or not message.strip():
                    logger.debug(f"Skipping empty message for session {session_id}")
                    continue

                # Input validation
                try:
                    message = _validate_message(message)
                except HTTPException as e:
                    await callback._send({"type": "error", "message": e.detail})
                    continue

                logger.debug(f"WS message: {message[:100]}...")

                await save_message(session_id, "user", message, db=db)

                start_time = time.time()
                result = await _run_with_keepalive(
                    websocket,
                    run_agent(session_id, message, context=summary, callback=callback),
                )
                duration_ms = int((time.time() - start_time) * 1000)

                parsed = parse_output(result.get("output", ""))

                await save_message(
                    session_id,
                    "assistant",
                    parsed.get("answer", ""),
                    db=db,
                )

                for action, observation in result.get("intermediate_steps", []):
                    tool_name = action.tool if isinstance(action.tool, str) else str(action.tool)[:128]
                    tool_input = action.tool_input if isinstance(action.tool_input, dict) else {"input": str(action.tool_input)}
                    tool_result = observation if isinstance(observation, dict) else {"output": str(observation)}

                    await save_tool_run(
                        session_id,
                        tool_name,
                        tool_input,
                        tool_result,
                        duration_ms,
                        db=db,
                    )

                if parsed.get("chart_spec"):
                    await callback._send({"type": "chart", "spec": parsed["chart_spec"]})

                    await save_chart(
                        session_id,
                        "auto",
                        parsed["chart_spec"],
                        message,
                        db=db,
                    )

                await callback._send({"type": "done"})
                
                # Update conversation summary for next message
                summary = await get_conversation_summary(session_id, db)

        except (WebSocketDisconnect, RuntimeError) as e:
            if isinstance(e, RuntimeError) and "accept" not in str(e) and "disconnect" not in str(e).lower():
                logger.exception(f"WebSocket error: session_id={session_id}, error={e}")
                try:
                    await callback._send({"type": "error", "message": f"Server error: {str(e)}"})
                except Exception:
                    pass
                return

            logger.info(f"WebSocket disconnected: session_id={session_id}")
            try:
                await redis.unregister_ws(session_id)
            except Exception as redis_e:
                logger.warning(f"Failed to unregister WebSocket from Redis for session {session_id}: {redis_e}")
        except Exception as e:
            logger.exception(f"WebSocket error: session_id={session_id}, error={e}")
            try:
                await callback._send({"type": "error", "message": f"Server error: {str(e)}"})
            except Exception:
                pass


@router.post("/chat/{session_id}", response_model=ChatResponse)
async def chat(
    session_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db_dependency),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    if not await _verify_session_ownership(session_id, current_user.id, db):
        raise HTTPException(status_code=404, detail="Session not found")

    session = await get_session_data(session_id, db)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    # Input validation
    message = _validate_message(body.message)

    await refresh_session_ttl(session_id, db)

    summary = await get_conversation_summary(session_id, db)

    await save_message(session_id, "user", message, db=db)

    start_time = time.time()
    result = await run_agent(session_id, message, context=summary)
    duration_ms = int((time.time() - start_time) * 1000)

    parsed = parse_output(result.get("output", ""))

    await save_message(
        session_id,
        "assistant",
        parsed.get("answer", ""),
        db=db,
    )

    for action, observation in result.get("intermediate_steps", []):
        tool_name = action.tool if isinstance(action.tool, str) else str(action.tool)[:128]
        tool_input = action.tool_input if isinstance(action.tool_input, dict) else {"input": str(action.tool_input)}
        tool_result = observation if isinstance(observation, dict) else {"output": str(observation)}

        await save_tool_run(
            session_id,
            tool_name,
            tool_input,
            tool_result,
            duration_ms,
            db=db,
        )

    if parsed.get("chart_spec"):
        await save_chart(
            session_id,
            "auto",
            parsed["chart_spec"],
            body.message,
            db=db,
        )

    steps = [
        {
            "tool": action.tool,
            "args": action.tool_input if isinstance(action.tool_input, dict) else {"input": action.tool_input},
            "result": observation if isinstance(observation, dict) else {"output": str(observation)},
        }
        for action, observation in result.get("intermediate_steps", [])
    ]

    return ChatResponse(
        answer=parsed["answer"],
        chart_spec=parsed["chart_spec"],
        has_error=parsed["has_error"],
        steps=steps,
    )


@router.get("/chat/{session_id}/messages")
async def get_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db_dependency),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not await _verify_session_ownership(session_id, current_user.id, db):
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()

    return {
        "count": len(messages),
        "messages": [msg.to_dict() for msg in messages],
    }


@router.get("/chat/{session_id}/charts")
async def get_charts(
    session_id: str,
    db: AsyncSession = Depends(get_db_dependency),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not await _verify_session_ownership(session_id, current_user.id, db):
        raise HTTPException(status_code=404, detail="Session not found")
    result = await db.execute(
        select(Chart)
        .where(Chart.session_id == session_id)
        .order_by(Chart.created_at)
    )
    charts = result.scalars().all()

    return {
        "count": len(charts),
        "charts": [chart.to_dict() for chart in charts],
    }
