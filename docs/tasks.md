# DataLens AI v2.0 - Implementation Tasks

Based on [PRD v2.0](docs/PRD.md) — **Terminal Aesthetic Edition**

## Phase 1: Backend Foundation (Week 1–2)
**Goal:** robust FastAPI server with migrated logic and WebSocket support.

- [x] **Project Setup**
  - [x] Initialize FastAPI project structure (`backend/`)
  - [x] Configure `uv` for dependency management
  - [x] Set up `pyproject.toml` with dependencies (FastAPI, LangChain, Pandas, Scikit-learn, etc.)

- [x] **Migration**
  - [x] Migrate `src/analyzers/statistical_analyzer.py` to `backend/analyzers/`
  - [x] Migrate `src/analyzers/ml_analyzer.py` to `backend/analyzers/`
  - [x] Migrate `src/time_series/` modules to `backend/analyzers/time_series/`
  - [x] Refactor migrated code to be pure functions (remove any Streamlit dependencies)

- [x] **Tool Wrapping**
  - [x] Create Pydantic input schemas for all analyzer functions
  - [x] Wrap functions as LangChain tools (14 tools: dataset, statistical, ml, time_series)
  - [x] Implement `describe_dataset` tool
  - [x] Implement `generate_chart_spec` tool

- [x] **API Core**
  - [x] Implement WebSocket endpoint (`/ws/{session_id}`)
  - [x] Create streaming callback handler for LangChain to WebSocket
  - [x] Implement file upload endpoint (`/upload`) with validation
  - [x] Create session management for file/dataframe context
  - [x] JWT authentication (register, login, me, sessions endpoints)

- [x] **Testing**
  - [x] Write integration tests for all migrated tools
  - [x] 264 tests passing across API, statistical, ML, time series, benchmarks (17 tools, 3 new)
  - [x] Comprehensive edge-case test suites for each tool domain

- [x] **Additional Tools (PRD-specified, deps installed)**
  - [x] Implement `run_umap` LangChain tool (umap-learn installed)
  - [x] Implement `run_hdbscan` LangChain tool (hdbscan installed)
  - [x] Implement `run_shap` LangChain tool (shap installed)

## Phase 2: Agent Core (Week 2–3)
**Goal:** A smart ReAct agent that can plan and execute analysis.

- [x] **Agent Implementation**
  - [x] Initialize LangChain ReAct agent
  - [x] Register the 14-tool registry with the agent
  - [x] Configure LLM (Groq — `qwen/qwen3-32b` via `langchain-groq`)
  - [x] Executor caching per session (10min TTL) to avoid cold-start penalty

- [x] **Context Management**
  - [x] Build Dataset Context Manager (schema, dtypes, sample rows)
  - [x] Implement context injection into system prompt

- [x] **Agent Logic**
  - [x] Implement structured output parser for "Final Answer"
  - [x] Implement error handling (retries with exponential backoff on tool failures)
  - [x] Create benchmark query set (35 queries) for testing
  - [x] Optimize system prompt for tool selection accuracy
  - [x] Rate limiting (max 3 concurrent agent runs per session)

## Phase 3: Frontend Shell (Week 3–4)
**Goal:** Next.js 16 application with terminal aesthetic and real-time communication.

- [x] **Frontend Setup**
  - [x] Initialize Next.js 16 (App Router) project
  - [x] Install and configure Tailwind CSS v4 with custom theme
  - [x] Install `shadcn/ui` — use as base, not final design
  - [x] Configure typography: Geist Mono (body), Satoshi (headings)
  - [x] Configure color tokens: warm black (#0A0A0F), burnt orange (#FF6B35), teal (#00DCB4)

- [x] **Core Layout**
  - [x] Implement Three-Panel Layout (Sidebar 280px, Chat flexible, Viz 360px)
  - [x] Build Sidebar component (File info, session controls, column browser)
  - [ ] Agent timeline scrubber at bottom — NOT IMPLEMENTED

- [x] **Agent Components**
  - [x] Build `AgentAvatar` — animated orb that pulses/shifts color
  - [x] Create `ThoughtStep` with typewriter animation (~60 WPM)
  - [x] Create `ToolCallCard` that builds itself (args populate one by one)
  - [x] Implement `AgentChat` with message thread

- [x] **Communication**
  - [x] Implement `useWebSocket` hook with exponential backoff reconnection
  - [x] Define TypeScript interfaces for WebSocket message types
  - [x] Add typing indicator when agent is thinking

- [x] **File Upload**
  - [x] Create Drag-and-Drop upload component
  - [x] Implement parsing animation — skeleton table shows while processing
  - [x] Connect upload to backend API
  - [x] Add upload progress indicator (real XHR percentage)

- [x] **Command Palette**
  - [x] Implement `Cmd+K` command palette
  - [x] Context-aware suggested queries based on data type
  - [x] Keyboard-first navigation

- [x] **Authentication Pages**
  - [x] Login page with redirect support
  - [x] Register page with validation
  - [x] Session history page
  - [x] Zustand auth store with token persistence

## Phase 4: Visualizations (Week 4–5)
**Goal:** High-quality 2D and 3D data visualization with post-processing effects.

- [x] **2D Visualizations (Recharts)**
  - [x] Create VegaLiteRenderer — parses Vega-Lite specs and renders with Recharts (bar, line, scatter, area)
  - [x] Vega-lite utility to extract encoding fields and chart type
  - [x] Custom tooltip with terminal-aesthetic styling
  - [ ] Build Histogram — bars grow from zero with stagger
  - [ ] Build Force-Directed Graph for correlations (Visx)
  - [ ] Build Bar chart — horizontal for SHAP importance

- [x] **3D Visualizations (React Three Fiber + Drei)**
  - [x] Set up `Scene3D` canvas with `OrbitControls`, lighting, environment
  - [x] Implement `PCAScatter3D` — glow, labels, color-coded groups
  - [x] Wire 3D scenes into VizPanel — renders PCAScatter3D when chart data contains x/y/z keys
  - [ ] Configure PostFX: depth-of-field, bloom glow
  - [ ] Implement `ClusterOrbs` — refractive semi-transparent spheres
  - [ ] Implement `UMAPEmbedding` — animated morph between n_neighbors values
  - [ ] Add particle trails for cluster confidence
  - [ ] Ensure responsive resizing of canvas

- [x] **Integration**
  - [x] Render Vega-Lite specs from agent as actual Recharts charts (bar, line, scatter, area)
  - [x] Data table available as collapsible details below chart
  - [ ] Viz canvas expands on "big insight" detection

## Phase 5: Polish & Deploy (Week 5–6)
**Goal:** Production-ready release with soul.

- [x] **UX Polish**
  - [x] Implement "Suggested Queries" via Cmd+K (not chips) — existing in CommandPalette
  - [x] Add loading states with agent avatar pulses — existing AgentAvatar animates per state
  - [x] Polish warm dark mode color palette — warm cream theme in globals.css
  - [x] Agent timeline scrubber — click to jump to reasoning step
  - [x] True row-by-row "unfold" animation on data table rows

- [x] **Features**
  - [x] **Auto-Insight Mode** — connected to real session data (columns, shape, dtypes), generates 3-5 contextual findings
  - [x] Add "Clear Session" / Reset functionality in sidebar
  - [ ] Implement Export functionality (PNG, PDF, CSV)
  - [ ] Sound design (optional, muted by default): keyboard clicks, pops, chimes

- [x] **Performance & Deployment**
  - [x] Create `Dockerfile` for Backend
  - [x] Create `Dockerfile` for Frontend
  - [x] Create `docker-compose.yml` for full stack orchestration
  - [x] Write `README.md` with setup instructions and test commands

---

## Design Checklist — "Does This Feel Alive?"

Before marking any UI task complete, ask:

- [ ] Does it have **weight**? (animations with easing, not linear)
- [ ] Does it **respond**? (hover states, focus rings, clicks)
- [ ] Does it **build itself**? (nothing appears instantly — everything animates in)
- [ ] Does it fit the **terminal aesthetic**? (monospace data, warm blacks, burnt orange accents)
- [ ] Would a user **screenshot this**? (if not, why not?)
