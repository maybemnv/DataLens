# API Guide

Complete reference for the DataLens AI REST and WebSocket APIs.

## Base URL

- Development: `http://localhost:8000`
- Production: `https://api.your-domain.com`

## Authentication

All endpoints except `/auth/register`, `/auth/login`, `/health`, and `/` require a JWT Bearer token:

```
Authorization: Bearer <token>
```

Get a token via `POST /auth/login`.

## File Upload

### `POST /upload`

Upload CSV, XLSX, or Parquet. Returns a `session_id`.

```
curl -X POST https://api.example.com/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@data.csv"
```

Response:
```json
{
  "session_id": "sess_abc123",
  "filename": "data.csv",
  "rows": 15000,
  "columns": 12,
  "column_names": ["date", "amount", ...]
}
```

Limits: 100MB default (`MAX_UPLOAD_MB`), CSV/XLSX/XLS/Parquet only.

## Sessions

### `GET /sessions` — List active sessions
### `GET /sessions/{session_id}` — Dataset metadata (shape, dtypes, missing values)
### `DELETE /sessions/{session_id}` — Delete session + all data

## Chat

### `POST /chat/{session_id}` — HTTP (synchronous)

```json
{
  "answer": "...",
  "chart_spec": { /* Vega-Lite */ },
  "has_error": false,
  "steps": [{ "tool": "...", "args": {}, "result": {} }]
}
```

### `WS /ws/{session_id}` — WebSocket (streaming)

Events: `thought`, `tool_call`, `tool_result`, `chart`, `answer`, `error`, `done`.

## Authentication

### `POST /auth/register` — Create account
### `POST /auth/login` — Returns JWT `{ "access_token": "...", "token_type": "bearer" }`
### `GET /auth/me` — Current user info
### `GET /auth/sessions` — List user's session history

## Health

### `GET /health` — `{ "status": "ok", "version": "2.0.0" }`

Interactive docs at `/docs` (Swagger) and `/redoc` (ReDoc).
