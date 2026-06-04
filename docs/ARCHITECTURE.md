# Architecture

## High-Level

```
Browser ──HTTP/WS──► FastAPI ──► LangChain ReAct Agent
                         │              │
                         ▼              ▼
                     PostgreSQL     17 Tools
                     Redis          │
                     MinIO          ▼
                              Analyzers
                           (stat/ml/ts)
```

## Backend

```
backend/
  main.py           FastAPI app, CORS, lifespan, global error handler
  config.py         Pydantic Settings — reads .env from project root
  auth.py           JWT (bcrypt + python-jose), HTTPBearer dependency
  session.py        DataFrame cache: Redis (parquet/base64) + LRU (maxsize=10)
  streaming.py      WebSocket streaming callback for LangChain
  agent/
    analyst_agent.py    ReAct agent definition, executor cache, rate limiter
  routes/
    auth.py         Register, login, me, sessions
    chat.py         HTTP chat + WebSocket /ws/{session_id}
    upload.py       File upload + parse (CSV/XLSX/Parquet)
  tools/
    __init__.py     17-tool registry
    dataset_tools.py, statistical_tools.py, ml_tools.py, time_series_tools.py
    guards.py       require_df() decorator
  analyzers/
    statistical_analyzer.py, ml.py, time_series/
  db/
    database.py     Async SQLAlchemy engine (pool 10/20), auto-create tables
  tasks/
    cleanup.py      Expired session cleanup (runs on startup)
  tests/            70 pytest tests
```

## Frontend

```
frontend/src/
  app/              Next.js App Router pages (workspace, login, register, history)
  components/
    agent/          AgentChat, AgentAvatar, ThoughtStep, ToolCallCard, ThinkingBlock
    charts/         VegaLiteRenderer (Recharts: bar, line, scatter, area, histogram)
    layout/         ThreePanelLayout, Sidebar, VizPanel
    viz/            Scene3D (R3F), PCAScatter3D, ClusterOrbs, UMAPEmbedding,
                    ParticleTrails, ForceDirectedGraph
    ui/             shadcn/ui primitives
  lib/
    store.ts        Zustand workspace store
    api.ts          HTTP + WebSocket client
    types.ts        Shared TypeScript types
    vega-lite-utils.ts  Vega-Lite spec → ChartConfig parser
    sound.ts        Web Audio API sound system
  hooks/
    useWebSocket.ts  WebSocket hook with exponential backoff
```

## Data Flow

1. Upload → FastAPI parses file → stores DataFrame in Redis + LRU cache → returns `session_id`
2. Query → WebSocket → ReAct agent streams thoughts/tool_calls/charts → UI renders incrementally
3. Agent picks tools → each tool reads DataFrame from session cache → runs analysis → returns result
4. Final answer + Vega-Lite spec → rendered as Recharts (2D) or R3F (3D when x/y/z present)
