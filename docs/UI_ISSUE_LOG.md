# UI Issue Log

This log tracks visual and localization regressions found during the local-first rebuild.

## 2026-04-24

### Theme Toggle Consistency

Status: fixed

Affected areas:
- App shell sidebar and footer controls
- Google Indexing workbench panels
- Rank and legacy page dark alignment rules
- Keyword and Article table inline selects
- GEO Writer three-column workbench and article preview
- Settings provider configuration panels

Symptoms:
- Light mode still displayed dark sidebar and dark workbench panels.
- Some page-specific CSS used hardcoded dark colors without `data-theme="dark"` scoping.
- Theme preference did not persist across reloads.

Fix:
- Persisted `smartkey.theme` in `AppShell`.
- Replaced hardcoded light-mode dark surfaces with design tokens.
- Scoped dark-specific overrides under `html[data-theme="dark"]`.
- Rebuilt frontend and smoke-tested primary routes for visible dark backgrounds in light mode.

Validation:
- `npm --prefix frontend run typecheck`
- `npm run build:frontend`
- Browser smoke against `http://127.0.0.1:3000/indexing`
- Route scan for dark visible backgrounds in light mode
- Added `npm run check:theme` to scan production-served routes for unexpected dark backgrounds in light mode.

### Google Indexing Localization

Status: fixed

Affected route:
- `/indexing`

Symptoms:
- Chinese UI still showed English labels such as `Credentials`, `Not indexed`, `Export CSV`, `Action`, `Max Pages`, `History`, `rows`, and `/ page`.

Fix:
- Added full `messages.indexing` entries for Chinese and English.
- Updated `Indexing.tsx` to read page copy from i18n instead of inline language conditionals and string literals.

Validation:
- `npm --prefix frontend run typecheck`
- `npm run build:frontend`
- Browser smoke for Chinese and English language modes

## Watch List

- Continue checking route-specific CSS before adding new feature pages.
- Prefer shared primitives and design tokens over page-local colors.
- If a page needs a darker editorial preview, scope it to dark mode or use a named preview class with a light-mode equivalent.
