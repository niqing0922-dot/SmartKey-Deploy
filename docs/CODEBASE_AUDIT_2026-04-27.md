# SmartKey Codebase Audit

Date: 2026-04-27

## Scope

Audit baseline:

- Product constraints: `AGENTS.md`, `PRD.md`, `TECH_DESIGN.md`
- Frontend: `frontend/src`
- Backend: `backend/main.py`, `backend/routers`, `backend/services`, `backend/db.py`
- Validation: `tests/api`, `tests/smoke`, `tests/e2e`, `tests/quality`

Audit goal:

- Verify that the repo is still converging toward a local-first, no-login-default, Web/FastAPI-first SmartKey workbench.
- Produce a prioritized issue list with concrete remediation direction.

## Remediation Update

Implemented on 2026-04-27:

- Moved Electron and Electron Builder dependencies from the root package to `desktop/package.json`.
- Updated desktop scripts so Web validation uses root dependencies, while desktop runtime and packaging use `desktop` dependencies.
- Updated portable packaging to read the Electron runtime from `desktop/node_modules/electron/dist`.
- Re-ran the previously blocked checks: `npm run check:prod` and `npm run check:theme` now pass from the root install path.
- Narrowed `check:backend` to the active FastAPI/Python backend surface.
- Updated backend docs and the API-key helper away from legacy login/token assumptions.
- Expanded docs reality checks to catch backend README and API-key helper regressions.
- Moved the legacy Express/JWT backend and old Supabase schema into `archive/legacy-backend-express`.
- Replaced `backend/package.json` with FastAPI command aliases and removed active Node backend dependencies.
- Updated active structure/design docs so they describe the FastAPI backend instead of `backend/src`.

## Automated Check Summary

Passed:

- `npm run check:frontend`
- `npm run check:backend`
- `npm run check:api`
- `npm run check:docs`
- `npm run check:tokens`
- `npm run build:frontend`
- `npm run check:prod`
- `npm run check:theme`
- `GET /api/health` on the FastAPI-served build

Important context:

- The root install path no longer pulls `electron`, which keeps Web/FastAPI validation separate from desktop packaging.
- Desktop packaging now requires a separate `npm --prefix desktop install` before running desktop packaging commands.

## Findings

### High

#### 1. Web-first validation was blocked by root dependency coupling

- Location:
  - `package.json`
  - `desktop/package.json`
  - `tests/smoke/prod-smoke.mjs`
  - `tests/quality/theme-consistency-check.mjs`
- Current behavior:
  - Fixed: `check:prod` and `check:theme` depend on root `playwright`, while Electron dependencies live under `desktop`.
  - Fixed: root install no longer depends on the desktop dependency chain.
- Conflict:
  - Before remediation, this broke the stated priority that Web/FastAPI is the main product path and Electron is not the primary audit target.
- Suggested direction:
  - Continue keeping Electron packaging checks separate from core product validation.
- Test follow-up:
  - Keep `check:prod` and `check:theme` in the core validation path.

#### 2. Legacy auth-centric backend remains in the active repo and directly conflicts with the rebuild target

- Location:
  - `archive/legacy-backend-express/src/app.js`
  - `archive/legacy-backend-express/src/routes/auth.js`
  - `archive/legacy-backend-express/src/middleware/auth.js`
  - multiple legacy Express routes under `archive/legacy-backend-express/src/routes/*`
- Current behavior:
  - Fixed: the JWT/authenticated Express backend has been moved to `archive/legacy-backend-express`.
  - Fixed: `backend/package.json` now starts the FastAPI backend instead of `src/app.js`.
- Conflict:
  - Before remediation, the rebuild target explicitly rejected this login-first/protected-route model.
- Suggested direction:
  - Ensure active backend checks and docs point only to the FastAPI path.
- Test follow-up:
  - Fixed: docs reality checks now guard active backend docs and helper scripts against auth-first language.

#### 3. Optional modules are still wired as peer navigation instead of being cleanly deferred behind the core workflow

- Location:
  - `frontend/src/App.tsx`
  - `frontend/src/components/layout/AppShell.tsx`
  - `frontend/src/pages/Deferred.tsx`
- Current behavior:
  - `rank-tracker`, `indexing`, and `import` are active first-class routes in the main nav.
  - A deferred-shell pattern exists (`Deferred.tsx`) but is not used for these optional modules.
- Conflict:
  - The rebuild priority says dashboard, keywords, articles, GEO writer, local data, and settings come first.
  - Optional rank/indexing modules should not compete with the core workbench surface unless they are clearly secondary and safely isolated.
- Suggested direction:
  - Use a consistent deferred/optional module wrapper for non-core modules until they meet the same quality bar as the core workflow.
  - Keep the main navigation hierarchy centered on the core workbench.
- Test follow-up:
  - Extend navigation smoke coverage to verify that optional modules never block entry into the core routes.

### Medium

#### 4. Shared UI primitives exist, but page implementations still bypass them heavily

- Location:
  - Shared primitives: `frontend/src/components/ui/*`
  - Example pages: `frontend/src/pages/ImagePlanner.tsx`, `frontend/src/pages/Settings.tsx`, `frontend/src/pages/Indexing.tsx`, `frontend/src/pages/Keywords.tsx`
- Current behavior:
  - `Card`, `Field`, `PageHeader`, `SearchToolbar`, `Alert`, and `EmptyState` are used in some pages.
  - `Button`, `DataTable`, and `Modal` are effectively not adopted in the page layer.
  - Several pages still render raw `.btn`, `.card`, `.tbl`, and ad hoc page header markup directly.
- Conflict:
  - The rebuild rules require shared primitives first and discourage page-specific ad hoc styling.
  - Partial adoption means the visual system is still fragile and inconsistently enforced.
- Suggested direction:
  - Standardize primary interaction surfaces on shared UI primitives before adding new feature work.
  - Replace raw button/table/header patterns with `Button`, `DataTable`, `PageHeader`, and related primitives.
- Test follow-up:
  - Add a lightweight static check or review checklist for raw `.btn`/`.tbl` usage outside shared primitive files.

#### 5. Some backend routers are doing orchestration/business logic and are not consistently thin

- Location:
  - `backend/routers/workbench.py`
  - `backend/routers/geo_writer.py`
  - `backend/routers/ai.py`
- Current behavior:
  - `workbench.py` contains a large amount of intent parsing, rule routing, keyword generation, and dispatch behavior.
  - `geo_writer.py` imports and calls `execute` directly from `backend.routers.ai`.
- Conflict:
  - The architecture rules require thin routes and reusable logic moved into services.
  - Router-to-router dependency is a concrete layering leak.
- Suggested direction:
  - Extract workbench dispatch/execution logic into a dedicated service module.
  - Extract AI execution into a backend service boundary and let both routers depend on the service instead of each other.
- Test follow-up:
  - Add service-level tests for dispatch and GEO generation paths so route tests stay narrow.

#### 6. Backend checks are still scoped too broadly and include legacy/runtime directories

- Location:
  - `package.json` `check:backend`
  - `backend/node_modules`
  - `archive/legacy-backend-express/src`
- Current behavior:
  - Fixed: `check:backend` now compiles only `backend/main.py`, `backend/db.py`, `backend/observability.py`, `backend/routers`, `backend/services`, and `backend/python`.
- Conflict:
  - Before remediation, this made the Python backend check noisy and weakened the signal of the actual FastAPI code path.
- Suggested direction:
  - Keep legacy Node and runtime/vendor directories out of the active Python validation path.
- Test follow-up:
  - Keep one explicit legacy audit step if needed, but keep it separate from the main backend readiness check.

### Low

#### 7. Documentation and helper scripts still leak pre-rebuild product language

- Location:
  - `backend/README.md`
  - `tests/check-api-key.js`
  - `archive/legacy-backend-express/schema.sql`
- Current behavior:
  - Fixed: `backend/README.md` now documents the FastAPI local-first backend.
  - Fixed: `tests/check-api-key.js` now checks `/api/settings` and `/settings` instead of login storage.
  - Fixed: the old Supabase schema has been moved out of the active backend directory.
- Conflict:
  - Before remediation, the remaining schema artifact did not break FastAPI but still created repo-level confusion.
- Suggested direction:
  - Keep active docs and helper scripts aligned with the local-first rebuild path only.
- Test follow-up:
  - Fixed: docs reality checks now include `backend/README.md` and `tests/check-api-key.js`.

#### 8. Design token migration is incomplete

- Location:
  - `tests/quality/design-token-check.mjs`
  - legacy style usage across `frontend/src/app/styles.css` and page-level class usage
- Current behavior:
  - Design token check passes, but it reports `Legacy styles.css raw color debt: 227`.
- Conflict:
  - The design system direction is present, but raw style debt remains significant.
  - This increases the chance of page-by-page visual drift.
- Suggested direction:
  - Continue migrating legacy raw color/style usage into token-driven shared surfaces.
  - Treat this as cleanup behind the shared primitive adoption work, not as isolated CSS polish.
- Test follow-up:
  - Keep the raw-color debt count visible and reduce it incrementally in future changes.

## Recommended Repair Priority

1. Remove or archive the active Express/JWT backend path from the main product surface.
2. Re-scope optional modules so the core workbench remains the dominant navigation and quality target.
3. Finish shared primitive adoption in pages before shipping more page-level UI.
4. Move workbench/AI orchestration out of routers into backend services.
5. Clean up legacy docs/helpers and tighten validation scope.

## Acceptance Criteria For The Next Cleanup Slice

- Core Web checks run without requiring Electron installation. Completed.
- Active backend path is unambiguously FastAPI + SQLite.
- No active route or startup doc reintroduces login-first behavior.
- Core pages use shared layout/UI primitives consistently.
- Optional integrations remain reachable but isolated and non-blocking.
