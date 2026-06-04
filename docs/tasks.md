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
  - [x] Agent timeline scrubber at bottom — clickable steps with timestamps

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
  - [x] Build Histogram — auto-binned, bars grow from zero with stagger
  - [x] Build Bar chart — horizontal for SHAP importance (detects nominal/ordinal Y encoding)
  - [x] Build Force-Directed Graph for correlations (D3 force simulation) — renders correlation data as interactive node-link graph

- [x] **3D Visualizations (React Three Fiber + Drei)**
  - [x] Set up `Scene3D` canvas with `OrbitControls`, lighting, environment
  - [x] Implement `PCAScatter3D` — glow, labels, color-coded groups
  - [x] Wire 3D scenes into VizPanel — renders PCAScatter3D when chart data contains x/y/z keys
  - [x] Configure PostFX: bloom glow (EffectComposer + Bloom) + depth-of-field (DepthOfField from @react-three/postprocessing)
  - [x] Implement `ClusterOrbs` — refractive semi-transparent spheres (MeshPhysicalMaterial with transmission 0.6, ior 1.5, visible interior points)
  - [x] Implement `UMAPEmbedding` — animated morph between position/targetPosition using buffer geometry morphing
  - [x] Add particle trails for cluster confidence — emitting particles with additive blending, animated via useFrame
  - [x] Ensure responsive resizing of canvas — ResizeObserver on container, updates canvas dpr on size change

- [x] **Integration**
  - [x] Render Vega-Lite specs from agent as actual Recharts charts (bar, line, scatter, area)
  - [x] Data table available as collapsible details below chart
  - [x] Viz canvas expands on "big insight" detection — auto-expands panel on first chart spec arrival, plays rising chime

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
  - [x] Implement Export functionality — PNG via SVG→canvas export on each chart, JSON spec export via VizPanel
  - [x] Sound design (optional, muted by default): mechanical keyboard clicks, soft pop on tool complete, rising chime on big insight, low thud on error, paper rustle on upload, ambient hum while thinking — Web Audio API, no dependencies, toggled via Volume icon in sidebar footer

- [x] **Performance & Deployment**
  - [x] Create `Dockerfile` for Backend
  - [x] Create `Dockerfile` for Frontend
  - [x] Create `docker-compose.yml` for full stack orchestration
  - [x] Write `README.md` with setup instructions and test commands

---

## Design Checklist — "Does This Feel Alive?"

Before marking any UI task complete, ask:

- [x] Does it have **weight**? (animations with easing, not linear) — ease-out on tool card snap, ease-in-out on avatar pulse, unfold stagger on data rows, fade-in-up on chart results, scale-in on thought block
- [x] Does it **respond**? (hover states, focus rings, clicks) — all buttons/interactive elements have hover color shifts, focus-visible ring-2 ring-primary, active states on viz tabs, sidebar column hover, timeline dot scale
- [x] Does it **build itself**? (nothing appears instantly — everything animates in) — charts draw via Recharts native animation, data table rows unfold with stagger, thoughts typewriter at 60 WPM, tool cards build args one-by-one, avatar pulsing indicates thinking state
- [x] Does it fit the **terminal aesthetic**? (monospace data, warm blacks, burnt orange accents) — Geist Mono body for all stats/data, #0A0A0F warm black background, #FF6B35 burnt orange primary, #00DCB4 teal success, Satoshi headings, bordered panels, monospace chart axis labels
- [x] Would a user **screenshot this**? (if not, why not?) — 3D scatter with bloom glow + depth-of-field blur, refractive cluster orbs with interior points visible, force-directed correlation graph, SHAP horizontal importance bars, histogram with auto-binning, auto-insight modal with dataset-aware findings — all visually distinctive and shareable
