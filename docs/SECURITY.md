# Security

## Authentication

- JWT (HS256) via `python-jose` + `passlib` (bcrypt)
- Tokens expire after `JWT_EXPIRE_MINUTES` (default 1440 = 24h)
- WebSocket connections validate token via query string

## Authorization

- Every API/WS call validates `session_id` belongs to authenticated `user_id`
- Sessions are isolated — no cross-user data access

## CORS

Production: restricted to `CORS_ORIGINS` (comma-separated in `.env`). Default allows nothing in production mode.

```
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

## Data Handling

- Uploaded DataFrames stored in Redis (encrypted in transit via TLS)
- LRU memory cache (max 10 DataFrames) — evicted when idle
- Session TTL defaults to 1 hour (`SESSION_TTL_SECONDS`)
- Files deleted when session expires or is cleared
- MinIO (optional) stores large files with S3-compatible encryption

## Input Validation

- File type whitelist: `.csv`, `.xlsx`, `.xls`, `.parquet`
- Upload size limit: `MAX_UPLOAD_MB` (default 100)
- Message length: `MAX_MESSAGE_LENGTH = 4000`
- SQLAlchemy parameterized queries prevent injection

## Rate Limiting

- Agent: max 3 concurrent runs per session (`asyncio.Semaphore`)
- WebSocket: 1 connection per session
- Rate limit headers returned on HTTP endpoints

## Production Checklist

- [ ] `JWT_SECRET_KEY` = `openssl rand -hex 32`
- [ ] `DB_PASSWORD` = 32+ random characters
- [ ] `ENVIRONMENT=production`
- [ ] `CORS_ORIGINS` set to your frontend domain(s)
- [ ] TLS enabled (nginx + Let's Encrypt)
- [ ] `DEBUG=false`
- [ ] Database firewall: allow only backend IP
- [ ] File upload limit reasonable for your use case
