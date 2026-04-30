# Refactor Roadmap

This roadmap translates the rebuild rules into small repository cleanup slices. Use it to keep the full-stack project organized while preserving a working local app after each step.

## Current Shape

The repository is already split into these runtime boundaries:

- `frontend/` React + TypeScript UI.
- `backend/` FastAPI, SQLite, services, repositories, and Python bridge scripts.
- `desktop/` Electron shell.
- `tools/` optional rank and indexing toolkits used by backend adapters.
- `archive/` historical code kept for reference.
- `tests/` API, production smoke, and static quality checks.

The main remaining organization issue is not top-level structure. It is continuing to move business logic out of large route files into services while keeping optional integrations isolated.

## Target Frontend Shape

Keep shared UI primitives in `frontend/src/components/ui`. Core product screens now live in route-driven feature folders:

```text
frontend/src/
  app/
    routes.tsx
    styles.css
    tokens.css
  components/
    layout/
    ui/
    brand/
  features/
    dashboard/
      DashboardPage.tsx
    keywords/
      KeywordsPage.tsx
      RecommendPage.tsx
      AnalyzePage.tsx
      ImportPage.tsx
      MatrixPage.tsx
    articles/
      ArticlesPage.tsx
      ImagePlannerPage.tsx
    geo-writer/
      GeoWriterPage.tsx
    local-data/
      LocalDataPage.tsx
    settings/
      SettingsPage.tsx
      settingsGuideConfig.ts
  pages/
    AIHome.tsx
    Rank.tsx
    Indexing.tsx
    Showcase.tsx
    Deferred.tsx
  services/
    api.ts
  types/
```

Rules for future moves:

1. Move one optional or legacy feature at a time.
2. Keep route behavior unchanged.
3. Update imports only for the moved feature.
4. Run `npm run check:frontend` after each slice.

## Target Backend Shape

Keep routers thin and move reusable work into services. Domain modules should follow this pattern:

```text
backend/
  routers/
    dashboard.py
    keywords.py
    articles.py
    geo_writer.py
    local_data.py
    settings.py
    workbench.py
    integrations/
    ai.py
    rank.py
    indexing.py
  services/
    keywords_service.py
    articles_service.py
    geo_writer_service.py
    local_data_service.py
    workbench_service.py
    integrations/
      ai_service.py
      rank_service.py
      indexing_service.py
  repositories/
  python/
```

The optional integrations stay behind backend routes and services. Missing credentials or Python dependencies should return graceful API errors instead of breaking startup.

## Cleanup Order

### Phase 1: Shared Shell And Primitives

- Keep `AppShell`, sidebar navigation, and sticky top header as the single shell.
- Keep `Card`, `Badge`, `Button`, `Field`, `SearchToolbar`, `DataTable`, `PageHeader`, `Modal`, and state components as shared primitives.
- Replace page-local button, table, badge, and card styles only when editing that page for product work.

Validation:

```bash
npm run check:frontend
npm run check:tokens
npm run check:theme
```

### Phase 2: Core Product Features

Move and stabilize in this order:

1. Done: `Dashboard.tsx` -> `features/dashboard/DashboardPage.tsx`
2. Done: `Keywords.tsx`, `Recommend.tsx`, `Analyze.tsx`, `Import.tsx`, `Matrix.tsx` -> `features/keywords/`
3. Done: `Articles.tsx`, `ImagePlanner.tsx` -> `features/articles/`
4. Done: `GeoWriter.tsx` -> `features/geo-writer/`
5. Done: `LocalData.tsx` -> `features/local-data/`
6. Done: `Settings.tsx`, `settingsGuideConfig.ts` -> `features/settings/`
7. Done: route declarations moved into `frontend/src/app/routes.tsx`

Do not move `Rank.tsx` or `Indexing.tsx` ahead of the core local workflow.

Validation:

```bash
npm run check:frontend
npm run check:api
npm run check:prod
```

### Phase 3: Backend Domain Split

Split large route files and move reusable logic into services only after the core UI routes are stable.

Recommended backend order:

1. Done: `backend/routers/db.py` split into `keywords.py`, `articles.py`, and `local_data.py`.
2. Done: router registration grouped in `backend/main.py`.
3. Move local backup, export, import, and reset logic into `backend/services/local_data_service.py`.
4. Move workbench intent detection and action execution into `backend/services/workbench_service.py`.
5. Keep `rank`, `indexing`, and `ai` isolated as optional integration routes.

Validation:

```bash
npm run check:backend
npm run check:api
```

### Phase 4: Optional Integrations

Only after dashboard, keywords, articles, GEO writer, local data, and settings are stable:

- Move rank UI and API into optional integration folders.
- Move indexing UI and API into optional integration folders.
- Keep AI disabled-but-explainable when no provider is configured.
- Keep Python tools in `tools/` unless they are rewritten as native backend services.

Validation:

```bash
npm run check:fast
```

## File Classification

Use this rule when deciding where a file belongs:

- Core app code: `frontend/`, `backend/`, `desktop/`.
- Shared development checks: `tests/`, `scripts/`.
- Runtime data: `backend/data/`, `backend/backups/`, or the Electron runtime directory.
- Generated output: `.artifacts/`.
- Imported optional capability modules: `tools/`.
- Historical reference: `archive/`.

Do not put new product code in `archive/`, `tools/`, or `.artifacts/`.

## Stop Conditions

Pause a cleanup slice if any of these happen:

- A route changes URL or default navigation unexpectedly.
- A frontend page starts calling an external provider directly.
- Backend startup depends on rank, indexing, AI, or credentials.
- Local database backup, export, import, or reset stops working.
- Tests need broad rewrites unrelated to the moved domain.
