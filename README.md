# SmartKey

SmartKey is a cloud-collaborative SEO workbench built as a standard multi-layer app:

- `frontend/` for the React UI
- `backend/` for the FastAPI service, Supabase/Postgres business data, and local rank/indexing history
- `desktop/` for the Electron desktop shell

The repository is organized so active product code, supporting tools, archived legacy files, and generated artifacts are clearly separated.

## Repository Layout

- `frontend/`
  Main web UI.
- `backend/`
  Main API, cloud workspace access, and local rank/indexing adapters.
- `desktop/`
  Desktop app shell.
- `tools/`
  Imported capability modules used by the backend.
- `tests/`
  End-to-end, smoke, API, and quality checks.
- `docs/`
  Active project documentation.
- `archive/`
  Deprecated files kept for reference only.
- `.artifacts/`
  Logs and generated test output.

Detailed structure notes live in [docs/PROJECT_STRUCTURE.md](C:/Users/24990/SmartKey-Deploy/docs/PROJECT_STRUCTURE.md).
Formal architecture notes live in [docs/ARCHITECTURE.md](C:/Users/24990/SmartKey-Deploy/docs/ARCHITECTURE.md).
Step-by-step cleanup order lives in [docs/REFACTOR_ROADMAP.md](C:/Users/24990/SmartKey-Deploy/docs/REFACTOR_ROADMAP.md).
Current rebuild planning lives in [PRD.md](C:/Users/24990/SmartKey-Deploy/PRD.md), [TECH_DESIGN.md](C:/Users/24990/SmartKey-Deploy/TECH_DESIGN.md), and [AGENTS.md](C:/Users/24990/SmartKey-Deploy/AGENTS.md).

## Feature Summary

The app currently includes:

- Supabase login and cloud workspace entry
- keyword library and article workflow
- AI-assisted keyword and content features
- Google rank tracking
- Google indexing inspection and submission
- legacy snapshot import into a cloud workspace

## Runtime Model

The product runs as:

`React UI -> FastAPI -> Supabase Postgres / local SQLite rank-indexing / Python tools`

Core keywords, articles, GEO drafts, and shared settings require Supabase Auth and a cloud workspace. Rank and indexing job history remain local in:

- `backend/data/app.db`
- `backend/backups/`

When you run the Electron shell, runtime data is redirected into `%APPDATA%/SmartKey/runtime/`.

## Local Setup

Install dependencies:

```bash
npm install
cd frontend && npm install
python -m pip install -r ../backend/requirements.txt
```

Set Supabase and database variables in `backend/.env` and `frontend/.env` before running the collaborative app. Optional external AI, ranking, or indexing integrations can also be configured through environment variables.

## Run The App

Web development mode:

```bash
npm run dev
```

Desktop mode:

```bash
npm run desktop
```

## Quality Checks

Fast local feedback:

```bash
npm run check:fast
```

Full local gate:

```bash
npm run check:all
```

## Notes

- Supabase setup is required for core collaborative workflows.
- Ranking and indexing history stay local even when core content data is cloud-backed.
- Runtime logs and test outputs are written under `.artifacts/`.
