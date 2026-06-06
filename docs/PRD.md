# DataLens AI — Product Requirements Document

### Autonomous Data Analyst Platform · v2.0 · February 2026

| Version | Status | Date     | Author |
| ------- | ------ | -------- | ------ |
| 2.0.0   | Draft  | Feb 2026 | You    |

---

## Project Summary

DataLens AI is a complete rebuild of the existing CSV Data Analyzer — moving from a Streamlit prototype to a production-grade, agentic data analysis platform. The new system combines a **Next.js 15 frontend** with a custom design language, React Three Fiber 3D visualizations with depth effects, a **FastAPI Python backend** preserving all existing analysis logic, and a **LangChain-powered Autonomous Data Analyst agent** that interprets natural language commands and orchestrates multi-step analytical workflows in real time.

**This is not another dashboard.** This is a tool that feels alive — where the agent's reasoning is visceral, visualizations draw themselves, and every interaction has weight.

---

## Table of Contents

1. [Product Overview &amp; Vision](#1-product-overview--vision)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Agentic Workflow Design](#4-agentic-workflow-design)
5. [UI Design System](#5-ui-design-system)
6. [Algorithm Expansion](#6-algorithm-expansion)
7. [Migration Plan from v1](#7-migration-plan-from-v1)
8. [Open Decisions &amp; Future Scope](#8-open-decisions--future-scope)

---

## 1. Product Overview & Vision

### 1.1 Problem Statement

The existing CSV Data Analyzer (v1) is a functional prototype built on Streamlit. While it delivers real analytical value, it suffers from three core limitations that prevent it from being a serious, production-ready tool:

- The Streamlit UI is rigid and visually dated, making it difficult to compose complex multi-panel layouts or interactive 3D visualizations
- Analysis is purely passive — users must know which tab to visit and manually trigger every operation, creating cognitive overhead
- The Gemini AI integration is shallow — a single-shot query with no reasoning chain, no tool use, and no ability to run follow-up analyses autonomously

### 1.2 Vision

> **DataLens AI transforms passive data exploration into an active conversation.** Users describe what they want to understand, and an autonomous agent decides which analyses to run, executes them in sequence, interprets results, and presents a coherent story — all in real time.

> **Design Philosophy:** This tool should feel like collaborating with a brilliant colleague, not filling out a Jira ticket. Every pixel, every animation, every sound should reinforce that the agent is _alive_ and _thinking_.

### 1.3 Success Metrics

| Metric                     | Target                            |
| -------------------------- | --------------------------------- |
| Time to first insight      | < 30 seconds from upload          |
| Agent task completion rate | > 85% on benchmark query set      |
| Supported file size        | Up to 100MB CSV                   |
| P95 agent response latency | < 8 seconds                       |
| Visualization render time  | < 2 seconds                       |
| **"Holy Shit" moment**     | User shares screenshot unprompted |

---

## 2. Technology Stack

### 2.1 Why This Stack

Every technology choice is justified by the specific requirements of an agentic data platform:

| Layer             | Technology                         | Justification                                                                                                         |
| ----------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Frontend UI       | Next.js 15 (App Router)            | Server components, streaming SSR, native WebSocket support, and best-in-class DX for React apps                       |
| Component Library | shadcn/ui + Tailwind CSS           | Unstyled, fully composable components — we own the design language, not a theme                                       |
| 3D Visualization  | React Three Fiber + Drei + PostGIS | Declarative Three.js with post-processing — depth-of-field, bloom glow, refractive materials                          |
| 2D Charts         | Recharts + Visx                    | Recharts for standard charts; Visx (D3-based) for custom correlation and heatmap renders                              |
| Agent Framework   | LangChain (Python)                 | Tool-calling agents, structured output, streaming callbacks, and a large ecosystem of integrations                    |
| LLM               | GPT-4o / Gemini 1.5 Pro            | Both supported via LangChain abstraction; users bring their own API key. Local Ollama (DeepSeek-R1) as private option |
| Backend API       | FastAPI (Python)                   | Async, fast, WebSocket-native. All existing analysis logic (pandas, sklearn, statsmodels) migrates directly           |
| Real-time Comms   | WebSockets                         | Streams agent reasoning steps and tool call results to the UI incrementally as they execute                           |
| Data Processing   | Pandas + Polars                    | Pandas for compatibility; Polars added for large file (50MB+) processing performance                                  |
| Typography        | Geist Mono + Satoshi               | Monospace body for data density, geometric sans for headings                                                          |

## 3. System Architecture

### 3.1 High-Level Architecture

The system is divided into three bounded contexts that communicate via a defined API surface:

```mermaid
graph LR
    Frontend[FRONTEND LAYER<br/>Next.js 15<br/>Custom Design<br/>React Three Fiber<br/>WebSocket Client<br/>PostFX Pipeline]
    Agent[AGENT LAYER<br/>LangChain ReAct Agent<br/>Tool Registry 12<br/>Streaming Callbacks<br/>Dataset Context Mgr<br/>Typewriter Animation]
    Analysis[ANALYSIS LAYER<br/>FastAPI Endpoints<br/>Existing Analyzers<br/>New ML Algorithms]

    Frontend <-->|WebSocket + REST| Agent
    Agent <-->|Function Calls| Analysis
```

**Communication flow:**

1. Frontend uploads file via REST → receives `session_id`
2. Opens WebSocket connection
3. User sends natural language query
4. Agent streams reasoning + tool calls over WebSocket (typewriter effect)
5. Analysis Layer executes each tool
6. Results stream back to UI — charts draw themselves, 3D scenes animate

### 3.2 Backend Directory Structure

```
backend/
  main.py                    # FastAPI app, WebSocket endpoint
  agent/
    analyst_agent.py         # LangChain ReAct agent definition
    tools/                   # One file per tool
      run_pca.py
      run_clustering.py
      detect_anomalies.py
      run_regression.py
      run_forecast.py
      run_shap.py
      describe_data.py
      generate_chart_spec.py
      ...
    callbacks.py             # Streaming callback → WebSocket
    context.py               # Dataset context per session
  analyzers/                 # Migrated from existing src/analyzers/
    statistical_analyzer.py
    ml_analyzer.py
    time_series/
  api/
    upload.py                # File upload + validation
    sessions.py              # Session management
  utils/
```

### 3.3 Frontend Directory Structure

```
frontend/
  app/
    layout.tsx               # Root layout, theme provider, font loading
    page.tsx                 # Landing / upload screen with file "unfold" animation
    workspace/[sessionId]/
      page.tsx               # Main analysis workspace
  components/
    agent/
      AgentChat.tsx          # Chat input + streaming message thread
      ThoughtStep.tsx        # Typewriter-animated reasoning step
      ToolCallCard.tsx       # Tool call with args + result summary (builds itself)
      AgentAvatar.tsx        # Abstract animated orb (glows when thinking)
    viz/
      Chart2D.tsx            # Recharts wrapper with draw-in animation
      Scene3D.tsx            # React Three Fiber canvas + PostFX
      PCAScatter3D.tsx       # 3D PCA with depth-of-field + glow
      ClusterOrbs.tsx        # Refractive cluster spheres + particle trails
      UMAPEmbedding.tsx      # Animated topology morph
      ForceGraph.tsx         # Correlation as force-directed graph
    data/
      DataTable.tsx          # Virtualized table (TanStack) with mono font
      ColumnSummary.tsx      # Per-column stats card
    layout/
      Sidebar.tsx            # File info + session controls
      CanvasPanel.tsx        # Persistent viz canvas with expand-on-result
      CommandPalette.tsx     # Cmd+K context-aware suggestions
  lib/
    websocket.ts             # WebSocket hook with message queue
    types.ts                 # Shared TypeScript types
    animations.ts            # Shared animation curves & timings
    theme.ts                 # Color tokens, typography scale
```

---

## 4. Agentic Workflow Design

### 4.1 Agent Architecture

The Autonomous Data Analyst uses a **LangChain ReAct (Reasoning + Acting)** agent with a streaming callback handler. The agent receives a natural language query and a structured dataset context, then iteratively reasons about which tools to call, executes them, observes results, and continues until it can generate a complete answer.

**The ReAct Loop (with UI feedback):**

```
Thought:     What does the user actually need?     → Typewriter animation, avatar pulses
Action:      Which tool answers this?              → Tool card builds itself
Observation: What did the tool return?             → Result snaps in with sound
Thought:     Is this enough, or do I need more?    → Avatar shifts color
Final Answer: Structured response with all findings and chart specs → Chart draws itself
```

### 4.2 Agent Tool Registry

The agent has access to 12 tools, each a well-defined Python function with a Pydantic input schema:

| Tool Name             | When Agent Uses It                                                             | Returns                                                |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `describe_dataset`    | First tool called on any query — gets schema, dtypes, null counts, sample rows | Structured dataset summary JSON                        |
| `get_column_stats`    | When user asks about a specific column or metric                               | Mean, median, std, skew, kurtosis, value counts        |
| `detect_anomalies`    | "find outliers", "anything weird", "anomalies"                                 | Row indices + scores from Isolation Forest + Z-score   |
| `run_correlation`     | "what's related", "find relationships", "correlation"                          | Correlation matrix + top N significant pairs           |
| `run_pca`             | "reduce dimensions", "visualize clusters", dimensionality queries              | Component loadings + explained variance + 2D/3D coords |
| `run_umap`            | Clustering, embedding, or when PCA variance < 70%                              | 2D/3D UMAP embeddings for visualization                |
| `run_kmeans`          | "cluster", "segment", "group users/customers"                                  | Cluster labels, centroids, silhouette score            |
| `run_hdbscan`         | When K is unknown or data is noisy                                             | Cluster labels with noise detection                    |
| `run_regression`      | "predict", "forecast", "what affects X"                                        | Coefficients, R², RMSE, feature importance             |
| `run_shap`            | After regression — "explain why", "feature importance"                         | SHAP values per feature + summary chart spec           |
| `run_forecast`        | Time series data, "next quarter", "trend"                                      | ARIMA/Prophet predictions + confidence intervals       |
| `generate_chart_spec` | Any time a visualization would help explain findings                           | Vega-Lite spec JSON consumed by frontend               |

### 4.3 Example Agent Traces

#### Query: `"Find anomalies in this dataset"`

```
1. describe_dataset       → learns shape, column types, null counts
2. get_column_stats       → identifies skewed distributions on all numeric cols
3. detect_anomalies       → Isolation Forest returns 23 anomalous rows
4. generate_chart_spec    → scatter plot highlighting anomalous rows in red
5. Final Answer           → narrative explaining anomaly pattern, affected rows, likely causes
```

#### Query: `"Cluster users and explain the patterns"`

```
1. describe_dataset       → identifies this looks like user/customer data
2. run_correlation        → finds which features cluster well together
3. run_pca                → reduces to 10 components explaining 85% variance
4. run_kmeans             → tries K=3,4,5 — K=4 has best silhouette score
5. run_umap               → generates 3D embeddings for visualization
6. generate_chart_spec×2  → 3D cluster viz + cluster profile bar chart
7. Final Answer           → cluster profiles in plain English, business interpretation
```

#### Query: `"Predict next quarter revenue"`

```
1. describe_dataset       → detects date column, confirms time series
2. get_column_stats       → checks revenue for trend, seasonality
3. run_forecast           → ARIMA + Prophet both run, best model selected by AIC
4. run_regression         → identifies leading indicator features
5. run_shap               → explains which features drive the forecast
6. generate_chart_spec    → forecast line chart with confidence intervals
7. Final Answer           → point forecast + range + key assumptions + risk factors
```

### 4.4 Streaming Architecture

The agent streams its reasoning process to the UI via WebSocket in real time. Each message has a typed structure:

```typescript
// WebSocket message types streamed to frontend
{ type: 'thought',     content: 'I need to check for time series patterns...' }
{ type: 'tool_call',   tool: 'run_forecast', args: { column: 'revenue' } }
{ type: 'tool_result', tool: 'run_forecast', summary: 'ARIMA(2,1,2) selected, AIC: 234.1' }
{ type: 'chart_spec',  spec: { ...vega-lite JSON... } }
{ type: 'answer',      content: 'Based on the analysis...' }
{ type: 'error',       message: 'Column not found: ...' }
```

### 4.5 Auto-Insight Mode (The "Holy Shit" Feature)

A toggle where the agent doesn't wait for queries. It:

1. Scans the dataset in parallel
2. Runs a battery of analyses (anomaly detection, correlation, clustering, trend analysis)
3. Surfaces 3-5 non-obvious findings with visualizations
4. Presents them as a **story**, not a list

**Example output:**

> _"I found something interesting. Revenue peaks every Q4 (expected), but the **variance is increasing** — 2024 had 3x the volatility of 2022. Also, **Category C is dragging down margins** — it's 40% of revenue but 60% of costs. Want me to dig deeper?"_

---

## 5. UI Design System

### 5.1 Design Philosophy

**Not another corporate dashboard.** This tool has a soul.

| Principle                       | What It Means                                                             |
| ------------------------------- | ------------------------------------------------------------------------- |
| **Warm, not cold**              | Near-black backgrounds with warm undertones, not sterile slate gray       |
| **Alive, not static**           | Agent avatar pulses, thoughts type out, charts draw themselves            |
| **Dense, not cramped**          | Monospace body text for data, but generous whitespace around key moments  |
| **Surprising, not predictable** | Viz canvas expands on big findings, timeline scrubber for agent reasoning |
| **3D with purpose**             | Depth-of-field, refraction, particle trails — never 3D bar charts         |

### 5.2 Color Tokens

```css
/* Backgrounds — warm near-black, not cold slate */
--background: #0a0a0f; /* Warm black */
--surface: #14141a; /* Elevated panels */
--surface-elevated: #1e1e28; /* Cards, modals */

/* Primary accents — burnt orange (energy, not corporate) */
--primary: #ff6b35; /* Burnt orange */
--primary-soft: #ffe5d9; /* Soft orange glow */

/* Secondary — teal for positive metrics */
--success: #00dcb4; /* Teal */
--success-soft: #d1fdf5;

/* Agent thoughts — deep purple */
--agent: #9d4edd; /* Deep purple */
--agent-soft: #e9d5ff;

/* Alerts */
--warning: #f59e0b; /* Amber */
--error: #ef4444; /* Red */

/* Text — warm off-white, not harsh #FFF */
--text-primary: #e8e6e3; /* Warm white */
--text-secondary: #c8c4bc; /* Warm light gray */
--text-muted: #8b8878; /* Warm gray */

/* Borders */
--border: #2a2a35; /* Warm dark border */
--border-hover: #3d3d4d;
```

### 5.3 Typography

```css
/* Headings — geometric, confident */
--font-heading: "Satoshi", "Inter", sans-serif;

/* Body — monospace for data density, terminal aesthetic */
--font-body: "Geist Mono", "JetBrains Mono", monospace;

/* Code / specs */
--font-mono: "JetBrains Mono", monospace;

/* Scale */
--text-xs: 0.75rem; /* 12px — labels, badges */
--text-sm: 0.875rem; /* 14px — body, stats */
--text-base: 1rem; /* 16px — default */
--text-lg: 1.125rem; /* 18px — emphasis */
--text-xl: 1.25rem; /* 20px — section titles */
--text-2xl: 1.5rem; /* 24px — page titles */
```

**Why monospace for body?** Analysts read numbers all day. Monospace makes tables align, stats scan better, and gives the whole thing a **terminal aesthetic** that fits the "agent" concept.

### 5.4 Main Workspace Layout

```mermaid
graph TD
    subgraph Main Workspace Layout
        direction LR
        Left[LEFT SIDEBAR<br/>280px fixed<br/>- File info card<br/>- Column browser<br/>- Data badges<br/>- Quick stats<br/>- Session history]
        Center[CENTER — AGENT CHAT<br/>Flexible width<br/>- Message thread<br/>- User messages<br/>- Agent thought steps<br/>- Tool call cards<br/>- Inline charts<br/>- Final answer<br/>- Command input bar<br/>- Cmd+K context]
        Right[RIGHT — VIZ CANVAS<br/>360px fixed<br/>- Chart gallery<br/>- 3D scene RTF<br/>- Depth-of-field + glow<br/>- Fullscreen toggle<br/>- Export PNG/SVG<br/>- Chart history tabs]

        Left ~~~ Center ~~~ Right
    end

    subgraph Agent Timeline
        Timeline[Bottom scrubber — shows full reasoning chain<br/>desc --> stats --> anomaly --> chart --> answer]
    end

    Center --> Timeline
```

### 5.5 When to Use 3D vs 2D

| Visualization Type       | Render                 | Enhancement                                                            |
| ------------------------ | ---------------------- | ---------------------------------------------------------------------- |
| PCA with 3 components    | **3D (RTF)**           | Depth-of-field blur on distant points, glow on hover, trajectory lines |
| UMAP embeddings          | **3D (RTF)**           | Animated morph between neighbor values, particle trails                |
| K-means cluster orbs     | **3D (RTF)**           | Semi-transparent refractive spheres, density visible through layers    |
| Correlation              | **Force Graph (Visx)** | Nodes = columns, edges = correlation strength, click to isolate        |
| Time series forecast     | 2D (Recharts)          | Line draws itself left-to-right, confidence band fades in              |
| Distribution / histogram | 2D (Recharts)          | Bars grow from zero with stagger                                       |
| SHAP feature importance  | 2D horizontal bar      | Bars slide in sorted by importance                                     |

### 5.6 Micro-Interactions

| Moment            | Animation                                        | Sound (optional)          |
| ----------------- | ------------------------------------------------ | ------------------------- |
| File upload       | File "unfolds" — rows animate in as parsed       | Soft paper rustle         |
| Agent thinking    | Avatar orb pulses + shifts color                 | None (or subtle hum)      |
| Thought appears   | Typewriter effect at ~60 WPM                     | Mechanical keyboard click |
| Tool completes    | Card "snaps" in with scale animation             | Soft pop                  |
| Chart renders     | Lines trace, bars grow, points fade with stagger | None                      |
| Error state       | Panel shakes, recovery suggestions appear        | Low thud                  |
| Big insight found | Viz canvas expands to fill center                | Rising chime              |

### 5.7 Agent Avatar

Not a robot icon. An **abstract animated orb** that:

- **Glows** when the agent is thinking
- **Shifts color** based on current mode (purple = reasoning, orange = executing, teal = done)
- **Pulses** in time with token generation
- **Particles** emit on tool completion

```
    Thinking:     ◉ (purple, soft glow, slow pulse)
    Executing:    ◉ (orange, brighter, faster pulse)
    Done:         ◉ (teal, steady, no pulse)
    Error:        ◉ (red, flickering)
```

---

## 6. Algorithm Expansion

### 6.1 Migration from v1

All existing algorithms from the Streamlit app migrate directly to the FastAPI backend as tool-callable functions. Nothing is lost — the existing `statistical_analyzer`, `ml_analyzer`, and `time_series` modules are **refactored, not rewritten**.

**Migrated from v1:** Descriptive stats, PCA, K-means, ARIMA, correlation analysis, group-by analysis, histograms, box plots, scatter plots.

### 6.2 New Algorithms Added in v2

| Algorithm              | Category                    | Library        | Why Added                                                                               |
| ---------------------- | --------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Isolation Forest       | Anomaly Detection           | `scikit-learn` | Handles high-dimensional anomalies better than z-score; works on non-normal data        |
| HDBSCAN                | Clustering                  | `hdbscan`      | No fixed K required; identifies noise points; better for real-world messy data          |
| UMAP                   | Dim. Reduction              | `umap-learn`   | Preserves local structure better than PCA; far superior for visualization               |
| SHAP Values            | Explainability              | `shap`         | Explains model predictions in plain English; the single most impressive feature to show |
| Prophet                | Forecasting                 | `prophet`      | Handles seasonality, holidays, missing data automatically — much easier than raw ARIMA  |
| Random Forest          | Regression / Classification | `scikit-learn` | Better than linear regression for non-linear relationships; native feature importance   |
| Permutation Importance | Explainability              | `scikit-learn` | Model-agnostic feature importance that doesn't overvalue high-cardinality features      |

---

## 7. Migration Plan from v1

### Phase 1 — Backend Foundation _(Week 1–2)_

- [x] Set up FastAPI project structure with `uv` dependency management
- [x] Migrate all existing analyzer modules from `src/` into `backend/analyzers/`
- [x] Wrap each analyzer function as a LangChain tool with Pydantic schemas
- [x] Implement WebSocket endpoint with streaming callback handler
- [x] Write integration tests for all migrated tools

### Phase 2 — Agent Core _(Week 2–3)_

- [x] Implement ReAct agent with the 12-tool registry
- [x] Build dataset context manager (schema, sample, column metadata per session)
- [x] Test agent traces against benchmark query set (30 representative queries)
- [x] Implement error handling and graceful fallbacks when tools fail

### Phase 3 — Frontend Shell _(Week 3–4)_

- [x] Next.js 15 project setup with custom theme (burnt orange + teal + warm black)
- [x] Three-panel layout implementation
- [x] WebSocket hook and message type system
- [x] File upload with "unfold" animation
- [x] Agent chat with typewriter-animated thought steps
- [x] Tool call cards that build themselves
- [x] Agent avatar component (animated orb)
- [x] Command palette (`Cmd+K`) for context-aware suggestions

### Phase 4 — Visualizations _(Week 4–5)_

- [x] 2D chart components with draw-in animations
- [x] React Three Fiber canvas with PostFX (depth-of-field, bloom)
- [x] PCA 3D scatter with glow + depth blur
- [x] UMAP 3D embedding with animated morph
- [x] K-means cluster orbs (refractive spheres)
- [x] Force-directed correlation graph
- [x] Viz canvas expand-on-result animation

### Phase 5 — Polish & Deploy _(Week 5–6)_

- [x] Agent timeline scrubber at bottom
- [x] Auto-Insight Mode (parallel analysis battery)
- [x] Export functionality (PNG charts, PDF report, CSV results)
- [x] Sound design (optional, muted by default)
- [x] Docker Compose setup: frontend + backend + nginx
- [x] Performance testing on large files (50MB+)
- [x] README + demo GIF

---

## 8. Open Decisions & Future Scope

### 8.1 Decisions to Make Before Building

| Decision                         | Options & Recommendation                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Python execution for large files | FastAPI server*(recommended)* vs Pyodide in-browser. Pyodide is impressive for demos but limited on 50MB+ files.   |
| LLM default                      | GPT-4o gives best tool-calling reliability. Gemini 1.5 Pro is cheaper. Recommend GPT-4o default, Gemini as option. |
| Local LLM support                | Ollama + DeepSeek-R1 via LangChain's Ollama integration. Good for privacy-sensitive data. Add in Phase 5.          |
| Authentication                   | None for v2 (local tool), or simple API key per session. Don't over-engineer.                                      |
| Chart persistence                | Store chart specs (JSON) not rendered images — regenerate on load for consistency.                                 |
| Sound design                     | Optional, muted by default. Use Howler.js for audio.                                                               |

### 8.2 v3 Scope — Out of Bounds for Now

These are real ideas worth building, but explicitly deferred to avoid scope creep:

- **Multi-agent CrewAI architecture** — separate Cleaning Agent, Analysis Agent, Visualization Agent, Report Writer working in parallel
- **MCP server for IDE integration** — Cursor / VS Code extension so analysts can query data from inside their editor
- **Database connectors** — PostgreSQL, BigQuery, Snowflake instead of file upload only
- **Collaborative sessions** — multiple users analyzing the same dataset simultaneously
- **Scheduled analysis reports** — automated runs with email/Slack delivery

---

## Appendix A: Design References

Don't look at other data tools. Look at:

| Product                                                       | What to Steal                                   |
| ------------------------------------------------------------- | ----------------------------------------------- |
| [Linear](https://linear.app)                                  | Micro-interactions, animation curves            |
| [Raycast](https://raycast.com)                                | Command palette, keyboard-first navigation      |
| [Obsidian](https://obsidian.md)                               | Warm dark theme, dense information legibility   |
| [The Pudding](https://pudding.cool)                           | Data storytelling that doesn't suck             |
| [Bloomberg Terminal](https://www.bloomberg.com/professional/) | Information density, monospace data readability |

---

_DataLens AI — PRD v2.0 · February 2026 · For internal development use_
