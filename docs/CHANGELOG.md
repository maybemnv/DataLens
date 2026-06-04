# Changelog

## [2.0.0] — 2026-06-05

### Added
- 17-tool ReAct agent with Groq LLM (qwen/qwen3-32b)
- UMAP, HDBSCAN, SHAP tools with comprehensive test suites (264 backend tests)
- Vega-Lite → Recharts renderer (bar, line, scatter, area, histogram, horizontal bar)
- 3D visualizations: PCA scatter glow, ClusterOrbs refractive spheres, UMAP morph animation, particle trails
- Force-directed correlation graph (D3 force simulation)
- Depth-of-field + Bloom PostFX on R3F scenes
- Auto-Insight Mode with session-aware findings
- Agent timeline scrubber with clickable steps
- Sound design (Web Audio API, muted by default)
- PNG export on each chart (SVG→canvas→blob)
- Docker Compose (dev + prod with nginx/PostgreSQL/Redis/MinIO)
- JWT authentication (register, login, session ownership)
- WebSocket streaming with exponential backoff reconnection

### Changed
- Migrated from Streamlit prototype to FastAPI + Next.js 16
- Replaced Gemini with Groq (qwen/qwen3-32b) as default LLM
- Replaced vega-embed with Recharts for 2D charts
- Color palette: warm cream (#FDFAF4 background, #E44D0A primary)
- Typography: Satoshi headings + Geist Mono body

### Fixed
- SHAP 0.46+ compatibility (3D ndarray instead of list)
- CORS uses settings-driven origins in production
- Frontend Dockerfile properly copies standalone build with static assets
- Backend Dockerfile multi-stage with proper deps for hdbscan/prophet
