# SmartKey Rebuild Agent Instructions

## Project Mission

This repository is being rebuilt into a cloud-collaborative SEO and GEO workbench with local-only rank and indexing job history.

All implementation work must support these goals:

- login-first cloud workspace flow
- stable cloud usability with local rank/indexing adapters
- UI rebuilt to match the provided `index.html` style direction
- core workflow first, optional external integrations second

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

Do not start with ranking, indexing, or advanced integrations before the core product is usable.

## Architecture Rules

### Frontend

- use React + TypeScript
- keep pages route-driven
- use shared primitives instead of page-specific ad hoc styling
- use backend APIs only
- do not call AI providers directly from the frontend

### Backend

- keep routes thin
- move reusable business logic into services
- treat Supabase Postgres as the source of truth for keywords, articles, GEO drafts, and shared settings
- keep ranking and indexing job history in local SQLite
- isolate external integrations so they cannot break core app usage

## Authentication Rules

- require Supabase Auth for the default collaborative product flow
- protect core routes behind a valid cloud session and workspace
- do not call business data tables directly from the frontend

Legacy auth code may remain temporarily during migration, but new work should not depend on it.

## UI Design Rules

The visual baseline is the provided `index.html`.

Required design direction:

- left sidebar navigation
- sticky top header
- light default theme
- clean workbench styling
- compact spacing
- soft gray backgrounds
- subtle borders
- consistent blue primary accent
- reusable badges, cards, tables, buttons, and forms

Avoid:

- heavy neon visual language
- gradient-heavy dashboard styling as the main identity
- page-by-page bespoke UI systems

## Component Rules

Before rewriting feature pages, first create shared UI primitives.

Preferred shared primitives:

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

New pages should use these shared primitives whenever possible.

## Domain Boundaries

Keep work grouped by domain:

- keywords
- articles
- geo writer
- cloud data migration
- settings
- optional rank/indexing integrations

Do not mix unrelated concerns into one large route or page file.

## External Integration Rules

### AI

- AI must be optional
- if AI is not configured, show clear setup guidance
- prefer structured JSON-like responses over raw prose

### Rank / Indexing

- keep Python integration isolated behind backend adapters
- do not make startup depend on those integrations
- return graceful errors when credentials or dependencies are missing

## Data Rules

- store core product data in Supabase Postgres
- keep rank and indexing operational history local
- support import from legacy local snapshots into the active cloud workspace
- add `geo_article_drafts` and `app_settings` when implementing rebuilt data flows

## Build and Test Rules

Use these validation layers:

- frontend production build
- backend startup check
- production browser smoke against backend-served UI
- API smoke for core routes

Do not rely only on Vite-dev-server-based tests for final validation.

## Implementation Rules

- make small, reviewable changes
- complete one slice at a time
- preserve app usability after each step
- prefer replacing broken flows over stacking patches on top of them

When unsure, favor:

- simpler architecture
- fewer dependencies
- clearer local workflows
- graceful degradation

## Current Rebuild Intent

The current rebuild target is:

- login-first entry into a cloud workspace
- HTML-style shell and UI system
- usable keyword and article workflows
- new GEO writer workflow
- cloud data management with local rank/indexing history

All new implementation work should be judged against that target.
