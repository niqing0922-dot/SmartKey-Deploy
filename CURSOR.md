# SmartKey Cursor Context

This file is for Cursor or any other code assistant working inside this repository.

## Project Identity

SmartKey is being rebuilt into a login-first cloud SEO and GEO workbench with:

- shared cloud workspace flows
- cloud-managed AI / Rank / Indexing capabilities
- desktop delivery through Electron
- local fallback support where explicitly preserved

The current repo is not a generic starter app. Treat it as a product rebuild with an existing direction, not a blank redesign.

## Product Priorities

Implement in this order:

1. shared layout and design system
2. dashboard
3. keyword library
4. articles
5. GEO writer
6. cloud data migration
7. settings
8. optional AI, rank, and indexing modules

Do not start with ranking, indexing, or advanced integrations before the core product remains usable.

## Current Product Direction

The current target product shape is:

- login-first cloud workspace
- cloud-first API usage
- platform-managed AI / Rank / Indexing credentials
- simplified settings for end users
- Electron desktop app for long-term release
- GitHub Releases based desktop updates

## Important Current Decisions

### Cloud and local behavior

- Prefer cloud API when configured.
- Preserve local built-in mode as a fallback.
- Frontend must never call AI providers directly.
- Backend or cloud API must proxy all external provider calls.

### Desktop behavior

- Desktop app is Electron-based.
- Update and exit actions exist in:
  - native app menu
  - settings page desktop actions
- The temporary top desktop status strip was intentionally removed.
- Do not re-add a duplicate dark status/header strip above the app content unless explicitly requested.

### Settings direction

End-user settings should stay minimal.

Keep:

- language
- default market
- default tone
- default article type
- default content language
- workspace/account summary
- desktop actions
- platform capability status

Do not reintroduce large end-user forms for:

- AI provider key input
- SerpAPI key input
- Google credentials path input
- Python path input
- provider enable toggles meant for internal platform operations

## Architecture Rules

### Frontend

- React + TypeScript
- route-driven pages
- shared UI primitives first
- backend APIs only
- avoid ad hoc page-specific styling when a shared primitive is appropriate

### Backend

- thin routers
- reusable logic in services
- Supabase Postgres is the source of truth for shared business data
- external integrations must fail gracefully

### Desktop

- `desktop/main.cjs` controls Electron lifecycle
- `desktop/preload.cjs` exposes desktop bridge APIs
- desktop UI actions should go through the preload bridge, not direct Node access from the renderer

## Data Rules

Use these boundaries unless deliberately changing architecture:

- Supabase Postgres:
  - keywords
  - articles
  - GEO drafts
  - shared settings
- local SQLite:
  - local runtime cache
  - rank/indexing operational history when still preserved locally

## UI Rules

Visual baseline:

- light workbench UI
- left sidebar navigation
- sticky top page header inside content
- compact spacing
- soft gray backgrounds
- subtle borders
- consistent blue accent

Avoid:

- duplicate brand areas
- heavy neon language
- dashboard-as-marketing-page styling for internal product pages
- one-off visual systems per page

### Desktop-specific UI note

Do not place a second global desktop status banner above the shell.

Preferred desktop action placement:

- native menu
- settings page desktop action area

## Shared Primitives To Prefer

Before creating new page-specific UI, prefer these shared patterns:

- `Card`
- `StatCard`
- `Badge`
- `Button`
- `Field`
- `SearchToolbar`
- `DataTable`
- `PageHeader`
- `EmptyState`
- `Alert`
- `Modal`

## Key Paths

- frontend shell: `frontend/src/components/layout/AppShell.tsx`
- global styles: `frontend/src/app/styles.css`
- settings page: `frontend/src/features/settings/SettingsPage.tsx`
- desktop main process: `desktop/main.cjs`
- desktop preload bridge: `desktop/preload.cjs`
- backend config: `backend/config.py`

## Run Commands

From repo root:

### Desktop local built-in mode

```powershell
npm run desktop
```

### Frontend checks

```powershell
npm run check:frontend
npm run build:frontend
```

### Backend validation

```powershell
python -m compileall backend
npm run check:api
```

### Desktop JS syntax checks

```powershell
node --check desktop/main.cjs
node --check desktop/preload.cjs
```

## Change Discipline

When editing this repo:

- make small, reviewable changes
- preserve working app behavior after each slice
- prefer replacing broken flows over layering more patches
- validate with production-style frontend build, not only dev mode

If something is ambiguous, prefer:

- simpler architecture
- fewer dependencies
- clearer cloud/local boundaries
- graceful degradation

## Current Caveats

- Some older files may still contain mojibake or historical string corruption.
- Be careful when editing legacy text-heavy files; validate with TypeScript build after every change.
- Do not assume old desktop UI additions should remain; several were temporary and intentionally removed.

## What Cursor Should Optimize For

Optimize for:

- stability
- clean UI consistency
- cloud-first product behavior
- minimal end-user setup burden
- maintainable Electron + web architecture

Do not optimize for:

- exposing more low-level config to end users
- adding duplicate desktop chrome
- speculative abstraction with no immediate product value
