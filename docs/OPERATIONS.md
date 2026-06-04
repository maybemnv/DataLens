# Operations Guide

Runbooks for running DataLens AI in production.

## Health Checks

| Endpoint | Expected | Frequency |
|----------|----------|-----------|
| `GET /health` | `{"status":"ok"}` | 30s |
| `GET /api/health` | 200 OK | 30s |
| WebSocket | connect + ping/pong | 60s |

```bash
curl -f http://localhost:8000/health && echo "ok"
curl -f http://localhost:3000/api/health && echo "ok"
```

## Logs

```bash
# All services
docker compose -f docker-compose.prod.yaml logs -f

# Specific service
docker compose -f docker-compose.prod.yaml logs -f backend
docker compose -f docker-compose.prod.yaml logs -f nginx
```

## Backup

```bash
# Database
docker compose -f docker-compose.prod.yaml exec db pg_dump -U datalens datalens > backup_$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.prod.yaml exec -T db psql -U datalens datalens < backup.sql
```

## Scaling

```bash
# Increase backend replicas
docker compose -f docker-compose.prod.yaml up -d --scale backend=3 backend
```

Requires a load balancer with session affinity for WebSocket connections.

## Common Incidents

### "Out of memory" errors
- Reduce `MAX_UPLOAD_MB` in `.env`
- Reduce `SESSION_TTL_SECONDS`
- Increase Docker memory limits

### "Too many open files"
- Increase `ulimit -n` on the host
- Reduce `DB_POOL_SIZE` in `database.py` (default 10/20)

### Agent not responding
- Check `GROQ_API_KEY` is valid
- Check Redis connectivity: `redis-cli ping`
- Check rate limiter: `MAX_REQUESTS_PER_WINDOW` in `analyst_agent.py`

### Database connection pool exhausted
- Check `SELECT count(*) FROM pg_stat_activity`
- Restart backend containers
- Reduce `DB_POOL_SIZE` if connections accumulate

## Upgrade

```bash
git pull
docker compose -f docker-compose.prod.yaml build --no-cache backend
docker compose -f docker-compose.prod.yaml up -d backend
```
