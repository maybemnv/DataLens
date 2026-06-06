# Redis — Upstash (Managed Serverless Redis)

## Role in Architecture

Redis is the **hot cache layer** in a 3-tier data storage system:

```
Layer 1: In-memory LRU (cachetools)   ← fastest, <100 entries, per-process
Layer 2: Redis/Upstash                ← fast, shared across processes
Layer 3: R2 / S3-compatible storage   ← durable, unlimited, slow
```

Writes fan out to all 3 layers. Reads hit Layer 1 → miss → Layer 2 → miss → Layer 3. If Layer 3 has the data, it re-populates Layer 2 for next time.

## Why Redis (Not Just R2)

| Concern              | Redis alone | R2 alone | Both |
|----------------------|-------------|----------|------|
| Sub-5ms DataFrame reads | Yes       | No       | Yes  |
| Survives process restart | No       | Yes      | Yes  |
| Rate limiting (INCR+EXPIRE) | Native | No       | Redis |
| WebSocket routing    | Yes        | No       | Yes  |

## Connection Strategy (`backend/db/redis_client.py`)

```python
if settings.is_upstash_redis:                    # UPSTASH_REDIS_REST_URL + TOKEN set
    client = UpstashRedis(url=..., token=...)
elif "upstash.io" in settings.redis_url:         # REDIS_URL contains upstash
    parse_and_use_upstash_client()
else:
    client = StandardRedis.from_url(settings.redis_url)
```

Upstash uses HTTP REST (not TCP). Requires `upstash-redis` package (lazy import — app starts without it, but Upstash connections fail).

## Key Patterns — What, Why, Lifecycle

### 1. `df:{session_id}` — DataFrame Hot Storage

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | String (base64-encoded parquet blob)   |
| TTL          | `settings.session_ttl_seconds` (1h)    |
| Size         | ~30-50% of original CSV                |
| Created by   | `session.py:_store_df_in_redis()`      |
| Read by      | `session.py:_load_df_from_redis()`     |
| Deleted by   | `session.py:delete_session()`          |
| TTL refreshed by | `session.py:refresh_session_ttl()` |

**Why**: Users re-query the same dataset repeatedly. Loading from Redis avoids R2 latency (~200ms → ~5ms).

**Init**: Created during `create_session()`. Written in parallel with R2 store.

**Fallback**: If Redis evicts the key (memory pressure), `get_df()` transparently falls back to R2 and re-populates Redis.

### 2. `cache:session:{session_id}` — Session Metadata Cache

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | JSON string                            |
| TTL          | 3600s (1h)                             |
| Content      | `{session_id, filename, row_count}`    |
| Created by   | `session.py:create_session()`          |
| Read by      | `session.py:get_session()`             |
| Deleted by   | `session.py:delete_session()`          |

**Why**: Avoid querying PostgreSQL for session metadata on every read. The same data is also in the in-memory LRU cache (`cache.py`), but Redis makes it available across backend replicas.

**Relationship to in-memory cache**: In-memory (`CacheClient` with LRUCache maxsize=100) is checked first; if miss, Redis is checked; if miss, PostgreSQL.

### 3. `ws:{session_id}` — WebSocket Routing

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | String (WebSocket connection ID)       |
| TTL          | 3600s (1h)                             |
| Created by   | `redis_client.py:register_ws()`        |
| Read by      | `redis_client.py:get_ws()` (streaming callback) |
| Deleted by   | `redis_client.py:unregister_ws()` (on disconnect) |

**Why**: When the agent produces a streaming response, `streaming.py` needs to know which WebSocket connection to forward tokens to. Redis maps `session_id → ws_id` so any backend process can find the correct connection.

**Init**: Created when user opens the workspace page (WebSocket handshake completes).

**TTL refresh**: The WebSocket heartbeat or periodic ping extends the TTL.

### 4. `agent_stream:{session_id}` — Streaming State

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | Hash (multiple fields)                 |
| TTL          | 300s (5min)                            |
| Fields       | `status`, `current_tool`, `error`      |
| Created by   | `redis_client.py:set_streaming_state()` |
| Read by      | `redis_client.py:get_streaming_state()` |
| Deleted by   | `redis_client.py:clear_streaming_state()` |

**Why**: Long-running agent chains need a recoverable state. If the WebSocket disconnects and reconnects, the frontend can ask "what's happening?" and get the current state from Redis instead of restarting.

**Init**: Set when the agent starts processing a user message. Cleared when the agent finishes.

### 5. `ratelimit:{key}` — Agent Execution Limiter

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | Integer (INCR counter)                 |
| TTL          | `window_seconds` (configurable)        |
| Created by   | `redis_client.py:rate_limit()`         |
| Checked by   | Rate-limiting middleware / chat route  |
| Auto-expires | After window                           |

**Why**: Prevent user from launching unlimited concurrent agent executions. Limits to 3 concurrent runs per session. Uses `INCR` + `EXPIRE` (atomic, Redis-native pattern).

**Init**: Created on first increment within a time window. Expires automatically after window.

### 6. `ping_test` — Liveness Check

| Property     | Value                                  |
|--------------|----------------------------------------|
| Type         | String ('pong')                        |
| TTL          | 10s                                    |
| Created by   | `redis_client.py:ping()`               |
| Read by      | `redis_client.py:ping()`               |
| Deleted by   | `redis_client.py:ping()` (after read)   |

**Why**: Simple SET + GET + DELETE to verify Redis is operational. Used by health check endpoint.

## Initialization Sequence

```
App startup (lifespan)
├── get_redis() called lazily on first use
│   └── RedisClient created (Upstash or standard)
│       └── No automatic ping — first request may be slower

First session creation
├── create_session()
│   ├── df:{id} ← base64 parquet blob (TTL = session TTL)
│   ├── cache:session:{id} ← metadata (TTL = 1h)
│   └── (R2 store runs in parallel)

First user chat
├── register_ws() → ws:{session_id}
├── rate_limit() → ratelimit:{key}
├── set_streaming_state() → agent_stream:{session_id}
├── (multiple tool runs, messages written to PostgreSQL)
├── clear_streaming_state() → agent_stream:{id} deleted
└── unregister_ws() on disconnect → ws:{id} deleted
```

## Key Modules that Touch Redis

| Module                     | What it does                          |
|----------------------------|---------------------------------------|
| `backend/session.py`       | DataFrame + metadata CRUD             |
| `backend/db/redis_client.py` | Client setup, WS routing, streaming, rate limiting |
| `backend/db/cache.py`      | In-memory LRU (companion cache)       |
| `backend/streaming.py`     | Reads `ws:{id}` to forward tokens     |
| `backend/routes/chat.py`   | Rate limit check, session retrieval   |
| `backend/main.py`          | Lifespan: `close_redis()` on shutdown |

## Memory Budget

| Key pattern  | Typical size | Max before eviction (Upstash free) |
|--------------|-------------|-------------------------------------|
| df:{id}      | 5–50 MB     | 100MB total (or 10MB on older plans)|
| cache:session:{id} | ~200 bytes | Negligible                   |
| ws:{id}      | ~100 bytes  | Negligible                          |
| agent_stream:{id} | ~300 bytes | Negligible                        |
| ratelimit:{key} | 8 bytes    | Negligible                          |

100MB CSV → ~35MB parquet + base64 in Redis. If multiple sessions active simultaneously, 3 datasets could exhaust the free tier. **R2 fallback handles this transparently** — oldest DataFrames are evicted automatically by Redis `maxmemory-policy` (default: `noeviction` on Upstash; `allkeys-lru` recommended for production).

## Troubleshooting

**`ImportError: upstash-redis`**: `uv add upstash-redis`. The app won't crash (ImportError caught), but any Upstash connection will fail.

**Rate limit exceeded**: 3 concurrent agent runs per session threshold. If you see errors from Upstash itself (not the app), check Upstash Console → Rate Limits (60 req/s on free).

**Key eviction**: Expected when memory is tight. The app recovers by loading from R2. Upgrade Upstash plan or enable `allkeys-lru` eviction for predictable behavior.

**Token rotation**: Update `UPSTASH_REDIS_REST_TOKEN` and restart backend. Token is cached at module level in `RedisClient` singleton.

**High latency**: Upstash is HTTP-based — each command is a REST call. For DataFrame operations (base64 decode + parquet read), expect 20-50ms. If too slow, the in-memory LRU cache handles the hottest datasets.
