# SmartKey Rebuild Technical Design

## 1. Goal

This document defines the technical design for rebuilding SmartKey into a local-first, single-user desktop-style SEO and GEO workbench.

The technical objective is to simplify the runtime path, reduce failure coupling, and restore usability before reconnecting optional external capabilities.

## 2. Technical Principles

1. Core workflow must not depend on login.
2. Core workflow must not depend on external APIs.
3. Optional modules must fail gracefully.
4. UI and backend must be modular by domain.
5. Production browser smoke tests should target the backend-served build.

## 3. Runtime Architecture

Runtime flow:

`Electron or Browser -> React Frontend -> Express Backend -> SQLite / AI / Python adapters`

### Frontend

- React
- TypeScript
- Vite

Responsibilities:

- render layout and pages
- handle local UI state
- call backend APIs only

### Backend

- Express
- SQLite access through shared database library

Responsibilities:

- expose application APIs
- orchestrate business logic
- manage local settings and data
- coordinate optional AI and Python integrations

### Local Storage

- SQLite is the main source of truth
- local backup and export features remain in backend utilities

### Optional Integrations

- AI provider via backend-only client
- Python ranking bridge
- Python indexing bridge

## 4. Repository Structure Target

### Frontend

```text
frontend/src/
  components/
    layout/
    ui/
    forms/
    tables/
    cards/
    modals/
  pages/
    Dashboard.tsx
    KeywordLibrary.tsx
    Articles.tsx
    GeoWriter.tsx
    LocalData.tsx
    Settings.tsx
  contexts/
    LanguageContext.tsx
    ToastContext.tsx
  hooks/
  services/
  lib/
  styles/
```

### Backend

```text
backend/src/
  routes/
    keywords.js
    articles.js
    geoWriter.js
    localData.js
    settings.js
    rank.js
    indexing.js
  services/
    keywordService.js
    articleService.js
    geoWriterService.js
    settingsService.js
    rankService.js
    indexingService.js
  lib/
    db.js
    storage.js
    aiClient.js
    pythonRunner.js
  middleware/
```

## 5. Frontend Design System

The UI should be rebuilt around a shared design-token layer modeled after the provided HTML file.

### Required token groups

- background colors
- border colors
- text colors
- state colors
- radius scale
- shadow scale
- layout constants

### Shared component primitives

- `AppShell`
- `SidebarNav`
- `PageHeader`
- `Card`
- `StatCard`
- `DataTable`
- `SearchToolbar`
- `Badge`
- `Button`
- `Modal`
- `EmptyState`
- `Alert`
- `Field`

### Styling direction

- light default theme
- compact workbench spacing
- enterprise dashboard feel
- soft gray backgrounds
- consistent blue primary accent

## 6. Authentication Removal Strategy

The product should move from token-gated local auth to implicit single-user local mode.

### Changes

- remove login and register routes from the main app flow
- remove `ProtectedRoute` from default navigation
- stop redirecting to `/login` for local use
- stop depending on `auth_token` for core routes

### Compatibility

If retaining auth tables for legacy reasons:

- backend may keep user records internally
- frontend should no longer require user session setup before usage

## 7. Data Model Direction

### Current logical entities

- keywords
- articles
- rank jobs
- rank results
- indexing jobs
- indexing pages

### Required additions

- `geo_article_drafts`
- `app_settings`

### Proposed logical schema

#### keywords

- id
- keyword
- type
- priority
- status
- notes
- position
- related_article
- created_at
- updated_at

#### articles

- id
- title
- content
- status
- keyword_ids_json
- created_at
- updated_at

#### geo_article_drafts

- id
- title
- primary_keyword
- secondary_keywords_json
- article_type
- audience
- target_market
- tone
- target_length
- brief_json
- outline_json
- draft_json
- status
- created_at
- updated_at

#### app_settings

- id
- key
- value_json
- updated_at

## 8. Domain API Design

### Core Routes

- `GET /api/health`
- `GET /api/dashboard/stats`
- `GET /api/keywords`
- `POST /api/keywords`
- `PUT /api/keywords/:id`
- `DELETE /api/keywords/:id`
- `POST /api/keywords/import`

- `GET /api/articles`
- `POST /api/articles`
- `PUT /api/articles/:id`
- `DELETE /api/articles/:id`

- `POST /api/geo-writer/draft`
- `POST /api/geo-writer/save`
- `GET /api/geo-writer/drafts`

- `GET /api/local-data/summary`
- `GET /api/local-data/export`
- `POST /api/local-data/import`
- `POST /api/local-data/backup`
- `GET /api/local-data/backups`
- `POST /api/local-data/reset`

- `GET /api/settings`
- `POST /api/settings`

### Deferred Routes

- `POST /api/ai/recommend`
- `POST /api/ai/analyze`
- `POST /api/rank/jobs/run`
- `GET /api/rank/jobs`
- `POST /api/indexing/jobs/run`
- `GET /api/indexing/jobs`

## 9. GEO Writer Technical Design

The GEO writer should not be implemented as a generic chat response page.

### Input model

- primary keyword
- secondary keywords
- article type
- audience
- target market
- tone
- target length

### Output model

- brief
- title options
- meta title
- meta description
- outline
- sectioned draft
- FAQ
- suggestions

### Backend processing flow

1. validate request
2. build prompt payload
3. call AI provider if configured
4. parse structured response
5. normalize result
6. return draft object

### Degraded mode

If AI is not configured:

- do not crash
- return a clear error payload or settings-required message
- frontend should show actionable setup guidance

## 10. External Capability Strategy

### Rank and Indexing

These modules should remain isolated from core product availability.

Rules:

- no startup dependency on ranking or indexing credentials
- no hard crash if Python adapters fail
- backend should return structured error responses
- frontend should display configuration guidance

### AI

AI provider logic should move behind a single backend client.

Suggested internal abstraction:

- `buildPrompt()`
- `runModel()`
- `parseStructuredResponse()`
- `normalizeResult()`

## 11. Failure Handling

The rebuild should replace hidden failures with explicit states.

### Required frontend states

- loading
- empty
- error
- configuration required
- success

### Required backend behavior

- catch and normalize integration failures
- avoid process exits from optional capability failures
- log useful diagnostics

## 12. Testing Strategy

### Build checks

- frontend production build
- backend startup
- Electron main-process syntax check

### API smoke

- dashboard
- keywords
- articles
- geo writer
- local data
- settings

### Production browser smoke

- run against `http://127.0.0.1:3000`
- validate page load and route access
- validate language switch
- avoid dependence on Vite dev server port

### Deferred integration testing

- AI real-call testing
- rank integration testing
- indexing integration testing

These should be credential-aware and not part of the minimum rebuild gate.

## 13. Delivery Plan

### Step 1

- remove login flow from frontend runtime
- make dashboard the default entry

### Step 2

- rebuild shell, sidebar, header, and tokens in HTML-page style

### Step 3

- refactor keyword library to new shared components

### Step 4

- refactor articles page to new shared components

### Step 5

- add GEO writer MVP

### Step 6

- refactor local data page and add settings page

### Step 7

- reconnect deferred modules behind stable optional integration patterns
