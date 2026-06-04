# Contributing

## Adding a New Tool

1. **Analyzer** — Add the analysis function to `backend/analyzers/` (pure function, no side effects)
2. **Schema** — Define Pydantic input schema in `backend/schemas.py`
3. **Tool wrapper** — Create `@tool` decorated function in `backend/tools/<category>.py`
4. **Register** — Import and add to `TOOL_REGISTRY` in `backend/tools/__init__.py`
5. **Agent guide** — Add to `TOOL_GUIDE` in `backend/agent/analyst_agent.py`
6. **Test** — Add tests in `backend/tests/` covering: edge cases, error handling, integration
7. **PRD** — Add to `docs/PRD.md` tool table if listed there

## Frontend Conventions

- Components in `frontend/src/components/` organized by domain (agent/, charts/, layout/, viz/)
- State in Zustand store (`store.ts`) — no prop drilling beyond 2 levels
- Vega-Lite specs parsed by `vega-lite-utils.ts` → rendered by VegaLiteRenderer (Recharts)
- 3D scenes use React Three Fiber + Drei + Postprocessing
- Custom hooks in `frontend/src/hooks/`
- Types in `frontend/src/lib/types.ts`

## Code Quality

- Backend: `ruff check .` must pass, type hints on all functions
- Frontend: `npx eslint src/ --no-warn-ignored` must pass (0 errors, 0 warnings)
- Tests: `npm run test` (vitest) must pass for frontend, `uv run pytest` for backend
- Build: `npm run build` must compile clean

## PR Process

1. Branch from `main`
2. Make changes, keep scope narrow
3. Ensure lint + test + build pass
4. Update relevant docs if behavior changes
5. Open PR with description of what and why
