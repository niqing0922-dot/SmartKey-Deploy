# SmartKey

SmartKey is a local-first SEO workbench built as a standard multi-layer app:

- `frontend/` for the React UI
- `backend/` for the FastAPI service and SQLite storage
- `desktop/` for the Electron desktop shell

The repository is organized so active product code, supporting tools, archived legacy files, and generated artifacts are clearly separated.

## Repository Layout

- `frontend/`
  Main web UI.
- `backend/`
  Main API and local data layer.
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
Current rebuild planning lives in [PRD.md](C:/Users/24990/SmartKey-Deploy/PRD.md), [TECH_DESIGN.md](C:/Users/24990/SmartKey-Deploy/TECH_DESIGN.md), and [AGENTS.md](C:/Users/24990/SmartKey-Deploy/AGENTS.md).

## Feature Summary

The app currently includes:

- direct local entry without login
- keyword library and article workflow
- AI-assisted keyword and content features
- Google rank tracking
- Google indexing inspection and submission
- local export, import, backup, and reset tools

## Runtime Model

The product runs as:

`Electron -> React UI -> FastAPI -> SQLite / Python tools`

When you run the web version directly, local data is stored in:

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

Optional environment variables can be set in `backend/.env` if you want external AI, ranking, or indexing integrations.

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

- No Supabase setup is required.
- Core workflows stay usable without optional external integrations.
- Runtime logs and test outputs are written under `.artifacts/`.
