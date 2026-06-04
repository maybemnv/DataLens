# DataLens AI

An autonomous data analysis platform powered by a LangChain ReAct agent (Groq LLM). Upload a structured dataset and ask questions in plain English — the agent selects and chains the appropriate analytical tools, returns precise results, and renders Vega-Lite chart specifications with 2D (Recharts) and 3D (React Three Fiber + PostFX) visualizations.

## Quick Start

### Prerequisites

- Python 3.13+
- [uv](https://docs.astral.sh/uv/) package manager
- Node.js 20+
- Docker (optional, for containerized deployment)

### 1. Clone and configure

```bash
git clone <repo-url>
cd State_Budget_Analysis
cp .env.example .env
# Edit .env — fill in GROQ_API_KEY, DB_USER, DB_PASSWORD
```

### 2. Backend setup

```bash
cd backend
uv venv
# Activate:
# Windows: .venv\Scripts\Activate
# Unix:    source .venv/bin/activate
uv sync
```

### 3. Frontend setup

```bash
cd frontend
npm install
```

### 4. Run in development

```bash
# Terminal 1 — backend (from project root)
uv run uvicorn backend.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

- API: http://127.0.0.1:8000 (docs at /docs)
- Frontend: http://localhost:3000

---

## Deployment

### Docker (development)

```bash
docker compose up --build
```

### Docker (production)

```bash
# 1. Copy and fill in production env vars
cp .env.production.example .env

# 2. Deploy core services (backend + frontend)
docker compose -f docker-compose.prod.yaml up -d backend frontend

# 3. Deploy full stack (adds PostgreSQL, Redis, MinIO, nginx)
docker compose -f docker-compose.prod.yaml --profile full up -d
```

The production stack includes:
- **nginx** reverse proxy on ports 80/443 with TLS support
- **PostgreSQL 16** for session/chat persistence
- **Redis 7** for agent executor caching and rate limiting
- **MinIO** for S3-compatible file storage
- **Backend** FastAPI server (8 workers)
- **Frontend** Next.js standalone server

### Production checklist

- [ ] Set strong `JWT_SECRET_KEY` via `openssl rand -hex 32`
- [ ] Set strong `DB_PASSWORD`
- [ ] Set `CORS_ORIGINS` to your frontend domain(s)
- [ ] Configure TLS certificates (see nginx.conf)
- [ ] Set `ENVIRONMENT=production`
- [ ] Set `LOG_LEVEL=INFO`

---

## Architecture

```
frontend/  src/app/          Next.js pages (workspace, login, register, history)
           src/components/   UI components (agent, chat, layout, 3D viz)
           src/lib/          API client, WebSocket client, Zustand store
           src/hooks/        useWebSocket, useBackendStatus

backend/   main.py           FastAPI app, CORS, lifespan, error handler
           config.py         Pydantic Settings (reads .env from project root)
           auth.py           JWT (bcrypt + python-jose), HTTPBearer
           session.py        DataFrame cache (Redis + LRU)
           streaming.py      WebSocket streaming callback
           agent/            ReAct agent, output parser
           routes/           auth, chat (HTTP + WS), upload
           tools/            17 LangChain tools
           analyzers/        statistical, ml, time_series analysis functions
           db/               async SQLAlchemy engine, Redis client
           tasks/            Expired session cleanup
           tests/            pytest backend tests (70)
```

---

## Tests

All backend tests require a `.env` file with valid credentials:

```bash
# Backend (from project root)
uv run pytest -v --tb=short backend/tests/test_api.py
uv run pytest -v --tb=short backend/tests/test_statistical_*.py

# Run all (requires asyncpg — see docker-compose.prod.yaml)
uv run pytest

# Frontend
cd frontend
npm run test
npm run test:coverage
npm run lint
```

---

## License

MIT
