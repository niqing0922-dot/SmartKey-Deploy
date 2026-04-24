# SmartKey Design Tokens

SmartKey uses a tokenized design system so the rebuilt workbench stays visually consistent across dashboard, keywords, articles, GEO writer, local data, and settings.

The source of truth is:

- `frontend/src/app/tokens.css`

Global application styles import the token file from:

- `frontend/src/app/styles.css`

## Token Layers

### Primitive Tokens

Primitive tokens describe raw design choices and should not be used directly in feature pages unless no semantic token exists yet.

Examples:

```css
--color-neutral-100
--color-blue-600
--space-8
--font-size-4
--radius-md
--shadow-xs
```

### Semantic Tokens

Semantic tokens describe product intent. Shared UI primitives and page-level CSS should prefer these.

Examples:

```css
--surface-canvas
--surface-panel
--border-default
--text-primary
--text-secondary
--accent-primary
--status-danger-surface
```

### Component Tokens

Component tokens bind the shared primitives to reusable UI elements.

Examples:

```css
--card-bg
--card-border
--button-primary-bg
--field-border
--table-head-bg
--sidebar-item-active-bg
```

## Theme Model

Light mode is the default `:root` token set. Dark mode only overrides semantic and component-level meanings inside `[data-theme="dark"]`.

Do not duplicate full component CSS for dark mode. Change tokens instead.

## Compatibility Aliases

The current rebuild CSS still contains legacy names such as `--bg`, `--text`, `--blue`, and `--border`.

These are now compatibility aliases in `tokens.css`, not the design-system source of truth. New work should use semantic or component tokens.

## Usage Rules

- Use `var(--surface-panel)` instead of `#ffffff`.
- Use `var(--accent-primary)` instead of a hard-coded blue.
- Use `var(--space-*)` for repeated spacing decisions in shared primitives.
- Use `var(--radius-*)` for shape decisions.
- Use component tokens inside shared primitives such as `Button`, `Card`, `Field`, `DataTable`, and `Badge`.
- Add a new token only when the value represents reusable product intent.
- Keep one-off layout details local, but keep colors, borders, shadows, radius, and core spacing tokenized.

## Quality Gate

Run:

```bash
npm run check:tokens
```

The check enforces three things:

- `styles.css` imports `tokens.css`.
- `tokens.css` includes primitive, semantic, component, and dark-mode token layers.
- New CSS and TSX files do not introduce raw hex or `rgb(...)` colors outside the token source.

`styles.css` still has legacy hard-coded color debt during the rebuild. The check reports that debt as a migration count but does not fail on it yet.
