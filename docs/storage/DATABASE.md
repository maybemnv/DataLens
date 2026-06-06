# Database — Supabase PostgreSQL

## Overview

SQLAlchemy async engine (`postgresql+asyncpg`) connecting to **Supabase PostgreSQL**. Tables are auto-created on startup — no manual migrations.

## Connection

### Connection String
```
postgresql+asyncpg://USER:PASSWORD@DB_HOST.supabase.co:5432/DB_NAME?sslmode=require
```

- Password chars must be URL-encoded: `*` → `%2A`, `@` → `%40`
- `?sslmode=require` is mandatory (Supabase rejects non-SSL)

### From Supabase Dashboard
1. **Project Settings → Database → Connection string**
2. Copy URI, replace `postgresql://` with `postgresql+asyncpg://`
3. URL-encode special chars in password
4. Append `?sslmode=require`

### Config Resolution (`backend/config.py`)

```python
@property
def database_url(self) -> str:
    if self.database_url_override:        # DATABASE_URL env var
        return self.database_url_override
    encoded_password = quote_plus(...)     # fallback: individual fields
    return f"{...}://{db_user}:{encoded_password}@{db_host}:{db_port}/{db_name}"
```

When `DATABASE_URL` is set, individual `DB_HOST/PORT/USER/PASSWORD/NAME` are ignored.

## Connection Pool (`backend/db/database.py`)

| Setting       | Value  | Purpose                                   |
|---------------|--------|-------------------------------------------|
| pool_size     | 10     | Persistent open connections               |
| max_overflow  | 20     | Extra connections during burst            |
| pool_timeout  | 30s    | Max wait for a connection                 |
| pool_recycle  | 1800s  | Recycle idle connections (anti-stale)     |
| pool_pre_ping | True   | Verify connection before use              |

> **Supabase free tier**: 15 max connections. pool_size=10 + max_overflow=20 = peak 30. If hitting limits, reduce to `pool_size=10, max_overflow=5`.

Driver: `AsyncAdaptedQueuePool` (asyncpg-compatible async pool).

## Initialization

On app startup, `backend/main.py` lifespan calls `init_db()`:

```python
async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

This runs `CREATE TABLE IF NOT EXISTS` for all models. No migration framework — schema changes require dropping and recreating tables (acceptable for current stage).

## Schema

### Table: `users`

| Column           | Type              | Constraints                          |
|------------------|-------------------|--------------------------------------|
| id               | `INTEGER`         | PK, autoincrement                    |
| email            | `VARCHAR(320)`    | NOT NULL, UNIQUE, INDEX              |
| username         | `VARCHAR(150)`    | nullable                             |
| hashed_password  | `VARCHAR(128)`    | NOT NULL (bcrypt hash)               |
| created_at       | `DATETIME`        | NOT NULL, default = utcnow           |

**Relationships**: `sessions` → has-many `Session` (cascade delete).

**Used by**: `backend/auth.py` — user registration, login, JWT verification. Created via `POST /api/auth/register`. Looked up by email on `POST /api/auth/login`.

**Data flow**:
1. User registers → `User` row created
2. User logs in → `User` looked up by email, password verified
3. Token issued → `user.id` embedded in JWT
4. Subsequent requests → `user.id` extracted from JWT, passed to session CRUD

---

### Table: `sessions`

| Column      | Type              | Constraints                          |
|-------------|-------------------|--------------------------------------|
| session_id  | `VARCHAR(64)`     | PK (UUID v4)                         |
| user_id     | `INTEGER`         | FK → `users.id`, nullable            |
| filename    | `VARCHAR(512)`    | NOT NULL                             |
| file_path   | `VARCHAR(1024)`   | nullable                             |
| schema      | `JSON`            | NOT NULL (column names, types, shape)|
| created_at  | `DATETIME`        | NOT NULL, default = utcnow           |
| updated_at  | `DATETIME`        | default = utcnow, onupdate            |
| expires_at  | `DATETIME`        | nullable (TTL cutoff)                |

**Indexes**: `ix_sessions_created_at`, `ix_sessions_expires_at`, `ix_sessions_user_id`.

**Relationships**: `user` → belongs-to `User`; referenced by `messages`, `tool_runs`, `charts`.

**Used by**: `backend/session.py` — CRUD operations.

**Data flow**:
1. Dataset uploaded → `POST /api/upload` → file parsed → `create_session()` inserts row
2. Session list → `list_sessions()` queries `expires_at > now()`
3. Session detail → `get_session()` reads row, caches in Redis + in-memory
4. Expired sessions → `backend/tasks/cleanup.py` deletes stale rows
5. Delete session → `delete_session()` removes row + cascaded data

---

### Table: `messages`

| Column      | Type              | Constraints                          |
|-------------|-------------------|--------------------------------------|
| id          | `INTEGER`         | PK, autoincrement                    |
| session_id  | `VARCHAR(64)`     | NOT NULL, INDEX                      |
| role        | `VARCHAR(20)`     | NOT NULL ('user' / 'assistant' / 'tool')|
| content     | `TEXT`            | NOT NULL                             |
| tool_name   | `VARCHAR(128)`    | nullable                             |
| tool_input  | `JSON`            | nullable                             |
| tool_result | `JSON`            | nullable                             |
| created_at  | `DATETIME`        | NOT NULL, default = utcnow           |

**Indexes**: `ix_messages_session_created` — composite (session_id, created_at) for fast chronological fetch.

**Used by**: `backend/routes/chat.py` — conversation persistence.

**Data flow**:
1. User sends message → `save_message()` creates row with `role='user'`
2. Agent responds → each tool call → `save_message()` creates row with `role='tool'`
3. Agent finishes → `save_message()` creates row with `role='assistant'`
4. Page reload → `GET /api/chat/{session_id}/messages` → all messages fetched ordered by `created_at`
5. Chat history context → last N messages injected into agent prompt

**`tool_name` truncation**: Persistence layer truncates to 128 chars to prevent DB overflow from malformed LLM output.

---

### Table: `tool_runs`

| Column      | Type              | Constraints                          |
|-------------|-------------------|--------------------------------------|
| id          | `INTEGER`         | PK, autoincrement                    |
| session_id  | `VARCHAR(64)`     | NOT NULL, INDEX                      |
| tool_name   | `VARCHAR(128)`    | NOT NULL                             |
| input_json  | `JSON`            | nullable                             |
| result_json | `JSON`            | nullable                             |
| error       | `TEXT`            | nullable                             |
| duration_ms | `INTEGER`         | nullable                             |
| created_at  | `DATETIME`        | NOT NULL, default = utcnow           |

**Indexes**: `ix_tool_runs_session_created` — composite (session_id, created_at).

**Used by**: `backend/routes/chat.py` — `save_tool_run()` after every `@tool` execution.

**Data flow**:
1. Agent decides to call a tool → `save_tool_run()` called with tool_name + input
2. Tool completes → row updated with result_json + duration_ms
3. Tool errors → row updated with error text
4. Debug view → tool runs displayed as timeline per message

**`tool_name` guard**: Truncated to 128 chars. Non-string/none values coerced. DB errors swallowed (logging only) — agent execution is never blocked by persistence failure.

---

### Table: `charts`

| Column      | Type              | Constraints                          |
|-------------|-------------------|--------------------------------------|
| id          | `INTEGER`         | PK, autoincrement                    |
| session_id  | `VARCHAR(64)`     | NOT NULL, INDEX                      |
| chart_type  | `VARCHAR(64)`     | nullable ('bar', 'line', 'scatter')  |
| vega_spec   | `JSON`            | NOT NULL (complete Vega-Lite spec)   |
| query       | `TEXT`            | nullable (NL query that generated it)|
| created_at  | `DATETIME`        | NOT NULL, default = utcnow           |

**Indexes**: `ix_charts_session_created` — composite (session_id, created_at).

**Used by**: `backend/tools/` — `generate_chart` / `visualization_tools` create chart specs; `backend/routes/chat.py` serves them to frontend.

**Data flow**:
1. Agent decides to visualize → tool creates `Chart` row with Vega-Lite JSON spec
2. Frontend fetches `/api/chat/{session_id}/charts` → renders using Vega-Embed
3. Chart persisted per session → survives page reload

---

## Entity Relationships

```
users (1) ──< (N) sessions (1) ──< (N) messages
                     │
                     ├──< (N) tool_runs
                     │
                     └──< (N) charts
```

- `sessions.user_id` → `users.id` (nullable — anonymous sessions allowed)
- `messages.session_id`, `tool_runs.session_id`, `charts.session_id` → `sessions.session_id`
- No `ON DELETE CASCADE` on FK columns (enforced at application layer via `delete_session()`)

## Lifecycle Summary

```
Upload ──→ Session row created
               │
               ├──→ Message rows (user query)
               ├──→ ToolRun rows (agent tool calls)
               ├──→ Chart rows (visualizations)
               └──→ Message rows (assistant answer)
               
Time passes ──→ expires_at reached ──→ cleanup deletes all
User deletes session ──→ cascade delete all children
```

## Troubleshooting

**`sslmode=require` error**: URL must end with `?sslmode=require`.

**`password authentication failed`**: Check URL encoding. Test with:
```python
from urllib.parse import quote_plus
print(quote_plus("Manav130105*"))  # → Manav130105%2A
```

**`too many connections`**: Reduce `max_overflow` from 20 to 5. Or upgrade Supabase plan.

**Connection drops**: `pool_recycle=1800` + `pool_pre_ping=True` already handle this.

**Missing tables**: The `init_db()` call auto-creates. If startup skipped (e.g., cold lambda), tables won't exist. Manually run `init_db()` or restart.
