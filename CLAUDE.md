# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (Next.js — run from `frontend/`)
```bash
npm run dev      # Dev server on port 3000
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (FastAPI — run from `backend/`)
```bash
pip install -r requirements.txt             # Install deps
uvicorn app.main:app --reload --port 8000   # Dev server on port 8000
```

### Backend Tests (run from `backend/`)
```bash
python test_db_creation.py
python test_ai_connection.py
python test_incidents.py
python test_upload.py
```

### Full Stack (Docker — run from repo root)
```bash
docker-compose up --build   # Starts frontend (3000), backend (8000), shadow-db PostgreSQL (5432)
```

## Architecture

**DB-Lighthouse AI** is a full-stack PostgreSQL schema analysis and optimization platform. Users connect their PostgreSQL database; the backend clones the schema into a local "shadow" database and runs all analysis there — production data is never touched.

### Stack
- **Frontend:** Next.js App Router + TypeScript + Tailwind CSS v4 + Shadcn/Radix UI
- **Backend:** FastAPI + SQLAlchemy + Pydantic v2 + Python 3.11+
- **Visualization:** React Flow + D3-force + Dagre for interactive schema graphs
- **AI:** Jan AI (local LLM at `localhost:1337/v1`) with Ollama/OpenAI/local-GGUF fallbacks, controlled by `AI_MODE` env var
- **Auth:** Firebase (currently mocked with hardcoded user in `frontend/src/context/AuthContext.tsx` for dev)

### Shadow Database Pattern
1. User submits their PostgreSQL connection string via `POST /api/connect-db`
2. Backend verifies connection, then runs `pg_dump --schema-only` to extract schema (no data)
3. Schema is restored into the local shadow PostgreSQL instance (`SHADOW_DB_URL`)
4. All subsequent analysis, index simulation, and optimization queries run against the shadow DB

### Backend Service-Oriented Layout
Each domain has a paired service + endpoint file:

| Domain | Service | Endpoint |
|--------|---------|----------|
| DB connection & cloning | `services/db_service.py` | `endpoints/db_connection.py` |
| AI Q&A | `services/ai_service.py` | `endpoints/analysis.py` |
| Schema introspection | `services/schema_analysis.py` | `endpoints/analysis.py` |
| Index analysis | `services/index_analyzer.py` | `endpoints/optimization.py` |
| Optimization | `services/optimization_service.py` | `endpoints/optimization.py` |
| Performance metrics | *(inline in endpoint)* | `endpoints/performance.py` |
| Anomaly detection | `services/anomaly_detector.py` | `endpoints/anomaly.py` |
| Incident engine | `services/incident_engine.py` | `endpoints/incidents.py` |
| Migration validation | `services/migration_analyzer.py` | `endpoints/governance.py` |
| Schema drift | `services/drift_detector.py` | `endpoints/governance.py` |
| Security/PII | *(inline in endpoint)* | `endpoints/security.py` |
| Semantic rules | *(inline in endpoint)* | `endpoints/semantic_rules.py` |
| MCP server | `services/mcp_server.py` | `endpoints/mcp.py` |
| Projects | *(inline in endpoint)* | `endpoints/projects.py` |
| MongoDB support | `services/mongodb_service.py` | — |
| SQL dialect conversion | `services/dialect_converter.py` | — |
| Synthetic data gen | `services/synthetic_data.py` | — |

All API routes are prefixed with `/api`. The router aggregator is `backend/app/api/__init__.py`. Settings (env vars + defaults) live in `backend/app/core/config.py` (uses `pydantic-settings`, reads `backend/.env`).

### Frontend Module Layout
- `frontend/src/app/dashboard/` — sub-routes per domain: `performance/`, `anomaly/`, `incidents/`, `security/`, `governance/`, `data/`, `semantic/`, `ai/`
- `frontend/src/app/features/` — standalone feature pages (e.g. `projects/`)
- `frontend/src/app/connect/` — DB connection flow; `frontend/src/app/login/` — login page
- `frontend/src/components/` — shared components: `SchemaGraph.tsx` (React Flow visualization), `AskAIPanel.tsx` (AI Q&A panel), `DashboardShell.tsx` (layout wrapper), `OptimizationReport.tsx`, `ProjectsSidebar.tsx`
- `frontend/src/context/AuthContext.tsx` — Firebase auth context (mock user enabled in dev at line 23)
- `frontend/src/lib/projectStorage.ts` — project persistence via localStorage; `firebase.ts` — Firebase client init
- **Path alias:** `@/*` → `frontend/src/*`

### AI Safety
`services/prompt_firewall.py` blocks dangerous SQL patterns (DROP, TRUNCATE, DELETE without WHERE, etc.) before passing queries to the LLM. Auto-appends `LIMIT 100` to unbounded SELECTs.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | User's source PostgreSQL connection string |
| `SHADOW_DB_URL` | `postgresql://postgres:root@localhost:5432/shadow_db` | Local shadow database |
| `JAN_API_URL` | `http://localhost:1337/v1` | Jan AI endpoint |
| `JAN_MODEL_NAME` | `mistral-ins-7b-q4` | Model used by Jan AI |
| `AI_MODE` | `JAN` | `JAN`, `OLLAMA`, or `LOCAL_FILE` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Frontend → backend base URL |
| `FIREBASE_CREDENTIALS_PATH` | — | Firebase service account JSON (optional) |
| `PSQL_PATH` / `PG_DUMP_PATH` | — | Windows PostgreSQL binary paths (needed for shadow cloning on Windows) |
