# Deployment Guide

## Quick Deploy

```bash
# 1. Clone and configure
git clone <repo>
cp .env.production.example .env
# Edit .env with your secrets

# 2. Deploy core (backend + frontend)
docker compose -f docker-compose.prod.yaml up -d backend frontend

# 3. Full stack (adds PostgreSQL, Redis, MinIO, nginx)
docker compose -f docker-compose.prod.yaml --profile full up -d
```

## Production Stack

| Service | Image | Function |
|---------|-------|----------|
| nginx | 1.27-alpine | TLS termination, reverse proxy, static assets |
| backend | custom (multi-stage) | FastAPI, 8000 |
| frontend | custom (multi-stage) | Next.js standalone, 3000 |
| db | postgres:16-alpine | Session/chat persistence |
| redis | redis:7-alpine | Agent executor cache, rate limiting, DataFrame cache |
| minio | minio/minio | S3-compatible file storage (optional) |

## Configuration

All via environment variables in `.env`. See `.env.production.example`.

Required: `GROQ_API_KEY`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET_KEY`

## TLS (Let's Encrypt)

```bash
# On the production server
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Uncomment the `listen 443 ssl` block in `nginx.conf` after certs are in place.

## Health Checks

- `GET /health` — API status
- `GET /api/health` — Frontend status
- Docker healthchecks are configured on all services

## Logging

Structured JSON logs to stdout. Collect with your preferred log aggregator (Datadog, Grafana Loki, etc.).

## Monitoring

| Tool | Purpose |
|------|---------|
| `GET /health` | Uptime monitoring |
| Container restarts | `docker ps` / orchestration dashboard |
| Error rate | nginx logs → log aggregator |
| Agent latency | Application logs → APM |
| DB connection pool | PostgreSQL metrics exporter |
