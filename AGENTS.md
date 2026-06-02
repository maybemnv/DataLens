# DataLens AI — AGENTS.md

## Project
FastAPI + LangChain ReAct agent (Groq LLM) + Next.js 16 frontend. Users upload CSV/XLSX/Parquet datasets and ask questions in natural language; the agent chains analytical tools and returns answers + Vega-Lite charts.

## Setup
- **Python**: 3.13 (see `backend/.python-version`)
- **Package manager**: `uv` for backend, `npm` for frontend
- **Backend env**: Create `.env` in project root. Key vars: `GROQ_API_KEY` (NOT `GEMINI_API_KEY` — README is stale), `DB_USER`, `DB_PASSWORD`, `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` or `REDIS_URL`
- **Config source**: `backend/config.py` reads `.env` from project root via pydantic-settings. Validate with `Settings()`.

## Key commands
```bash
# Backend
cd backend
.venv\Scripts\Activate          # Windows
uv run uvicorn backend.main:app --reload      # dev server at :8000 (run from project root, NOT from backend/)
uv run pytest -v                              # all backend tests (70)
uv run pytest tests/backend/test_api.py -v    # focused test file
uv run ruff check .                           # lint

# Frontend
cd frontend
npm run dev                     # dev server at :3000
npm run test                    # vitest
npm run test:coverage           # vitest with coverage
npm run lint                    # eslint
```

## Testing quirks
- Backend tests need `.env` with `GROQ_API_KEY` + `DB_USER` + `DB_PASSWORD` (imports fail without them)
- Tests at `backend/tests/` (not root `/tests/`). Plugin `pytest_asyncio` with `asyncio_mode = auto`
- Some tests skipped (`@pytest.mark.skip(reason="Requires live database connection")` and `test_upload_too_large`)
- `conftest.py` at `backend/` root adds parent dir to sys.path so `import backend.xxx` works
- Frontend vitest config at `frontend/vitest.config.ts`, tests in `src/**/*.{test,spec}.{ts,tsx}`, uses happy-dom

## Agent
- LangChain `create_react_agent` with `ChatGroq`, model = `qwen/qwen3-32b` (configurable via `MODEL_NAME`)
- Executor cached per session (10min TTL) to avoid cold-start penalty
- Rate-limited: max 3 concurrent agent runs per session
- 14 tools in `backend/tools/__init__.py`, LangChain `@tool` decorator, Pydantic arg schemas in `backend/schemas.py`

## Architecture
```
frontend/  src/app/          Next.js pages (workspace/[sessionId], login, register, history)
           src/components/   UI components (agent, chat, layout, viz)
           src/lib/          api client, WebSocket client, store (Zustand)
           src/hooks/        useWebSocket, useBackendStatus

backend/   main.py           FastAPI app, lifespan, CORS, error handler, routers
           config.py         pydantic-settings (reads .env from project root)
           auth.py           JWT (bcrypt + python-jose), HTTPBearer
           session.py        DataFrame cache: Redis (parquet/base64) + LRU memory (maxsize=10)
           streaming.py      WebSocket streaming callback
           agent/            ReAct agent, output parser
           routes/           auth, chat (HTTP + WS), upload
           tools/            14 LangChain tools (dataset_tools, statistical_tools, ml_tools, time_series_tools)
           analyzers/        statistical, ml, time_series analysis functions
           db/               async SQLAlchemy engine (pool=10/20), auto-create tables on startup
           tasks/            cleanup.py — expired session cleanup
           tests/            pytest backend tests
```

## Docker
- `compose.yaml` — dev (backend + frontend only)
- `docker-compose.prod.yaml` — prod (adds PostgreSQL, Redis, MinIO)
- Backend Dockerfile uses `uv sync --frozen`, copy `.venv`, runs `uvicorn backend.main:app`

## Pre-commit / CI
- No pre-commit hooks, no CI workflows found
- Lint with `ruff` (backend) and `eslint` (frontend)
