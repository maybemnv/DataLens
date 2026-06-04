import asyncio
import io
import json
import base64
from datetime import timedelta
from typing import Optional

import boto3
import botocore.exceptions
import pandas as pd
from botocore.config import Config as BotoConfig
from cachetools import LRUCache
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .db import get_cache, get_redis
from .db.models import Session as SessionModel
from .logger import get_logger
from .utils.time import utcnow

logger = get_logger(__name__)

# ─── Memory-safe DataFrame cache ─────────────────────────────────────
# Max 10 DataFrames in memory. Entries are evicted automatically by
# LRU policy AND manually when sessions expire or are deleted.
_memory_cache: LRUCache[str, pd.DataFrame] = LRUCache(maxsize=10)

# ─── R2 / S3-compatible storage ────────────────────────────────────
_R2_CLIENT: boto3.Session | None = None


def _get_r2_client() -> boto3.Session:
    global _R2_CLIENT
    if _R2_CLIENT is None:
        _R2_CLIENT = boto3.Session(
            aws_access_key_id=settings.r2_access_key,
            aws_secret_access_key=settings.r2_secret_key,
        )
    return _R2_CLIENT


async def _store_df_in_r2(session_id: str, df: pd.DataFrame) -> None:
    if not settings.has_r2:
        return
    try:
        buf = io.BytesIO()
        df.to_parquet(buf, index=False)
        key = f"df/{session_id}.parquet"

        def _put():
            s3 = _get_r2_client().client(
                "s3",
                endpoint_url=settings.r2_endpoint,
                config=BotoConfig(signature_version="s3v4"),
            )
            s3.put_object(
                Bucket=settings.r2_bucket,
                Key=key,
                Body=buf.getvalue(),
                ContentType="application/octet-stream",
            )

        await asyncio.to_thread(_put)
    except Exception as e:
        logger.warning(f"Failed to store DataFrame in R2 (session {session_id}): {e}")


async def _load_df_from_r2(session_id: str) -> Optional[pd.DataFrame]:
    if not settings.has_r2:
        return None
    try:
        key = f"df/{session_id}.parquet"

        def _get():
            s3 = _get_r2_client().client(
                "s3",
                endpoint_url=settings.r2_endpoint,
                config=BotoConfig(signature_version="s3v4"),
            )
            obj = s3.get_object(Bucket=settings.r2_bucket, Key=key)
            return obj["Body"].read()

        data = await asyncio.to_thread(_get)
        return pd.read_parquet(io.BytesIO(data))
    except botocore.exceptions.ClientError:
        return None
    except Exception as e:
        logger.warning(f"Failed to load DataFrame from R2 (session {session_id}): {e}")
        return None


async def _delete_df_from_r2(session_id: str) -> None:
    if not settings.has_r2:
        return
    try:
        key = f"df/{session_id}.parquet"

        def _delete():
            s3 = _get_r2_client().client(
                "s3",
                endpoint_url=settings.r2_endpoint,
                config=BotoConfig(signature_version="s3v4"),
            )
            s3.delete_object(Bucket=settings.r2_bucket, Key=key)

        await asyncio.to_thread(_delete)
    except Exception as e:
        logger.warning(f"Failed to delete DataFrame from R2 (session {session_id}): {e}")


def _resolve_id(raw: Optional[str]) -> str:
    if not raw:
        return ""
    s = raw.strip()
    if s.startswith("{"):
        try:
            return str(json.loads(s).get("session_id", s))
        except (json.JSONDecodeError, AttributeError):
            pass
    return s


def _build_schema(df: pd.DataFrame, filename: str) -> dict:
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    categorical_cols = df.select_dtypes(exclude="number").columns.tolist()
    return {
        "filename": filename,
        "shape": list(df.shape),
        "columns": df.columns.tolist(),
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "missing_values": int(df.isnull().sum().sum()),
        "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
    }


async def _store_df_in_redis(session_id: str, df: pd.DataFrame) -> None:
    try:
        buf = io.BytesIO()
        df.to_parquet(buf, index=False)
        encoded = base64.b64encode(buf.getvalue()).decode("utf-8")
        redis = await get_redis()
        await redis.client.setex(
            f"df:{session_id}",
            settings.session_ttl_seconds,
            encoded,
        )
    except Exception as e:
        logger.warning(f"Failed to store DataFrame in Redis (session {session_id}): {e}")


async def _load_df_from_redis(session_id: str) -> Optional[pd.DataFrame]:
    try:
        redis = await get_redis()
        data = await redis.client.get(f"df:{session_id}")
        if not data:
            return None
        decoded = base64.b64decode(data)
        return pd.read_parquet(io.BytesIO(decoded))
    except Exception as e:
        logger.warning(f"Failed to load DataFrame from Redis (session {session_id}): {e}")
        return None


async def create_session(df: pd.DataFrame, filename: str, db: AsyncSession, user_id: Optional[int] = None) -> str:
    import uuid
    session_id = str(uuid.uuid4())

    await asyncio.gather(
        _store_df_in_redis(session_id, df),
        _store_df_in_r2(session_id, df),
    )

    schema = _build_schema(df, filename)
    expires_at = utcnow() + timedelta(seconds=settings.session_ttl_seconds)

    session_record = SessionModel(
        session_id=session_id,
        user_id=user_id,
        filename=filename,
        schema=schema,
        expires_at=expires_at,
    )
    db.add(session_record)
    await db.commit()

    cache = get_cache()
    cache.set(f"session:{session_id}", {"filename": filename, "schema": schema})

    try:
        redis = await get_redis()
        await redis.cache_set(
            f"session:{session_id}",
            {"session_id": session_id, "filename": filename, "row_count": len(df)},
            ttl=settings.session_ttl_seconds,
        )
    except Exception as e:
        logger.warning(f"Failed to set Redis cache for session {session_id}: {e}")

    logger.info(f"Created session: {session_id}, rows={df.shape[0]}, cols={df.shape[1]}")
    return session_id


async def get_session(session_id: str, db: AsyncSession) -> Optional[dict]:
    resolved_id = _resolve_id(session_id)

    cache = get_cache()
    cached = cache.get(f"session:{resolved_id}")
    if cached:
        logger.debug(f"Session cache hit: {resolved_id}")
        return cached

    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == resolved_id)
    )
    record = result.scalar_one_or_none()

    if record is None:
        return None

    if record.expires_at is not None and record.expires_at < utcnow():
        logger.warning(f"Session expired: {resolved_id}")
        return None

    session_data = {
        "session_id": record.session_id,
        "filename": record.filename,
        "schema": record.schema,
        "row_count": record.schema.get("shape", [0, 0])[0] if record.schema else 0,
    }

    cache.set(f"session:{resolved_id}", session_data)

    try:
        redis = await get_redis()
        await redis.cache_set(f"session:{resolved_id}", session_data, ttl=3600)
    except Exception as e:
        logger.warning(f"Failed to set Redis cache for session {resolved_id}: {e}")

    return session_data


async def get_df(session_id: str, db: AsyncSession) -> Optional[pd.DataFrame]:
    resolved_id = _resolve_id(session_id)

    if resolved_id in _memory_cache:
        logger.debug(f"DataFrame memory cache hit: {resolved_id}")
        return _memory_cache[resolved_id]

    df = await _load_df_from_redis(resolved_id)
    if df is None:
        logger.debug(f"Redis miss for {resolved_id}, trying R2...")
        df = await _load_df_from_r2(resolved_id)
        if df is not None:
            # Re-populate Redis for fast access
            await _store_df_in_redis(resolved_id, df)

    if df is None:
        logger.warning(f"DataFrame not found: {resolved_id}")
        return None

    _memory_cache[resolved_id] = df
    return df


async def delete_session(session_id: str, db: AsyncSession) -> bool:
    resolved_id = _resolve_id(session_id)

    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == resolved_id)
    )
    record = result.scalar_one_or_none()

    if record is None:
        return False

    await db.delete(record)
    await db.commit()

    get_cache().delete(f"session:{resolved_id}")

    # FIX #1: Evict DataFrame from memory cache to prevent memory leak
    if resolved_id in _memory_cache:
        del _memory_cache[resolved_id]
        logger.debug(f"Evicted DataFrame from memory cache: {resolved_id}")

    try:
        redis = await get_redis()
        await redis.cache_delete(f"session:{resolved_id}")
        await redis.client.delete(f"df:{resolved_id}")
    except Exception as e:
        logger.warning(f"Failed to delete Redis data for session {resolved_id}: {e}")

    await _delete_df_from_r2(resolved_id)

    logger.info(f"Deleted session: {resolved_id}")
    return True


async def list_sessions(db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(SessionModel.session_id).where(
            SessionModel.expires_at > utcnow()
        )
    )
    return [row[0] for row in result.all()]


async def refresh_session_ttl(session_id: str, db: AsyncSession) -> bool:
    resolved_id = _resolve_id(session_id)

    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == resolved_id)
    )
    record = result.scalar_one_or_none()

    if record is None:
        return False

    record.expires_at = utcnow() + timedelta(seconds=settings.session_ttl_seconds)
    await db.commit()

    try:
        redis = await get_redis()
        await redis.client.expire(f"df:{resolved_id}", settings.session_ttl_seconds)
    except Exception as e:
        logger.warning(f"Failed to refresh Redis TTL for session {resolved_id}: {e}")

    return True
