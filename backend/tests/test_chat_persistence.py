"""Tests for defensive guards in chat.py save_message / save_tool_run.

These guard against malformed LLM output (long tool names, non-string
tool names, etc.) that would otherwise fail DB inserts.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.routes.chat import save_message, save_tool_run


@pytest.mark.asyncio
async def test_save_tool_run_truncates_long_tool_name():
    db = AsyncMock()
    long_name = "x" * 500  # exceeds VARCHAR(128)

    await save_tool_run("session-1", long_name, {"a": 1}, {"b": 2}, 100, db=db)

    db.add.assert_called_once()
    tool_run = db.add.call_args[0][0]
    assert len(tool_run.tool_name) == 128
    assert tool_run.tool_name == "x" * 128
    db.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_save_tool_run_handles_non_string_tool_name():
    db = AsyncMock()

    await save_tool_run("session-1", {"weird": "dict"}, {}, {}, 50, db=db)

    tool_run = db.add.call_args[0][0]
    assert isinstance(tool_run.tool_name, str)


@pytest.mark.asyncio
async def test_save_tool_run_handles_none_tool_name():
    db = AsyncMock()

    await save_tool_run("session-1", None, {}, {}, 50, db=db)

    tool_run = db.add.call_args[0][0]
    assert tool_run.tool_name == "unknown"


@pytest.mark.asyncio
async def test_save_tool_run_swallows_db_errors():
    db = AsyncMock()
    db.commit.side_effect = Exception("DB blew up")

    # Should not raise — log warning instead
    await save_tool_run("session-1", "describe_dataset", {}, {}, 50, db=db)
    db.rollback.assert_awaited()


@pytest.mark.asyncio
async def test_save_tool_run_skips_when_db_is_none():
    await save_tool_run("session-1", "any", {}, {}, 50, db=None)  # no error


@pytest.mark.asyncio
async def test_save_message_truncates_long_tool_name():
    db = AsyncMock()

    await save_message(
        "session-1", "assistant", "answer", tool_name="x" * 500, db=db
    )

    msg = db.add.call_args[0][0]
    assert len(msg.tool_name) == 128


@pytest.mark.asyncio
async def test_save_message_swallows_db_errors():
    db = AsyncMock()
    db.commit.side_effect = Exception("DB blew up")

    await save_message("session-1", "assistant", "answer", db=db)
    db.rollback.assert_awaited()
