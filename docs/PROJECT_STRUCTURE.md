# Project Structure

This repository is now organized around a standard product workflow: app code, supporting tools, tests, docs, archived legacy files, and generated artifacts are separated.

## Core Product

- `frontend/`
  React + TypeScript + Vite application UI.
- `backend/`
  FastAPI application, SQLite storage, dashboard, AI, rank, indexing, GEO writer, settings, and local-data routes.
- `desktop/`
  Electron desktop shell that starts the backend and opens the app window.

These are the main folders for ongoing feature development.

## Supporting Tools

- `tools/google-rank-tracker/`
  Original Google ranking Python tool, now referenced by the backend adapter.
- `tools/google-indexing/`
  Original Google indexing and submission toolkit, now referenced by the backend adapter.

These folders are product dependencies, but they are not the primary place for product UI or API work.

## Tests

- `tests/smoke/`
  Backend-served production smoke checks.
- `tests/quality/`
  Static quality checks for docs, design tokens, and theme structure.
- `tests/helpers/`
  Shared test helpers and mock data.

## Documentation

- `README.md`
  Main project entry and local run guide.
- `docs/PROJECT_STRUCTURE.md`
  Repository layout and development rules.
- `docs/reference/`
  Reference material kept for product context, not for runtime.

## Archive

- `archive/legacy-root/`
  Deprecated root-level entry files kept only for reference.
- `archive/docs-legacy/`
  Historical deployment and old documentation artifacts.
- `archive/legacy-backend-express/`
  Pre-rebuild Express/JWT backend and Supabase schema kept only for reference.

Anything inside `archive/` should be treated as read-only history unless there is a clear migration need.

## Generated Artifacts

- `.artifacts/logs/`
  Runtime logs.
- `.artifacts/test-results/`
  Generated test output artifacts.

Generated artifacts should not live in the repo root.

## Local Data

- `backend/data/`
  Default repo-local SQLite runtime when running the backend directly.
- `backend/backups/`
  Default repo-local backups when running the backend directly.

When launched through Electron, runtime data is redirected into `%APPDATA%/SmartKey/runtime/`.

## Development Rules

1. Add product features in `frontend/`, `backend/`, or `desktop/`.
2. Treat `tools/` as external capability modules, not the main app surface.
3. Put temporary outputs in `.artifacts/`, not the repo root.
4. Move deprecated experiments into `archive/` instead of leaving them mixed with active code.

For the current rebuild cleanup sequence, use [REFACTOR_ROADMAP.md](C:/Users/24990/SmartKey-Deploy/docs/REFACTOR_ROADMAP.md).
