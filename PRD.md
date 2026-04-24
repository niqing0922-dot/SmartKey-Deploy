# SmartKey Rebuild PRD

## 1. Product Summary

SmartKey will be rebuilt as a local-first single-user SEO and GEO workbench.

This rebuild has four top-level product goals:

- remove login and registration from the user flow
- restore a stable minimum usable product
- redesign the UI to match the style direction of the provided `index.html`
- reorganize features around one clear workflow instead of a collection of disconnected tools

The rebuilt product should feel like a clean desktop operations console for keyword planning, GEO writing, article management, and SEO operations.

## 2. Product Positioning

SmartKey is not a multi-tenant SaaS platform.

For the current phase, SmartKey is:

- a single-user local tool
- a desktop-first workbench with browser-compatible development
- a structured content operations app
- a workflow-driven SEO and GEO application

## 3. Target User

Primary user:

- a solo operator, marketer, founder, content manager, or SEO practitioner working on one machine

User expectations:

- open the app and use it immediately
- manage local data without account setup
- create and edit keyword and article assets quickly
- generate GEO-oriented content drafts through guided workflows
- optionally connect AI and Google-related capabilities later

## 4. Core Product Workflow

The rebuilt experience should center around this workflow:

`keywords -> analysis or writing prep -> GEO article drafting -> article management -> rank/index operations -> local backup and export`

This workflow must be visible in both the information architecture and the page hierarchy.

## 5. Rebuild Scope

### 5.1 Phase 1 MVP

This rebuild phase should focus only on the minimum usable product.

Included in MVP:

- Dashboard
- Keyword Library
- Articles
- GEO Writer
- Local Data
- Settings
- shared layout and design system

Removed from MVP entry flow:

- Login
- Register
- any user-facing auth requirement before using the product

Deferred but preserved for later:

- AI Recommend
- AI Analyze
- Google Ranking
- Google Indexing

These modules may remain present in the repository, but they should not block the usability of the core product.

## 6. Functional Requirements

### 6.1 No Login Flow

Requirements:

- app launches directly into the main workspace
- no login page is shown
- no registration flow is required
- local usage must not depend on auth token creation

Acceptance:

- a fresh install opens directly to the main application shell
- protected-route style redirect logic is removed from the default app flow

### 6.2 Dashboard

Purpose:

- show current project status at a glance

Requirements:

- show total keywords
- show pending, planned, and done keyword counts
- show recent articles
- show quick GEO writing entry
- show local data summary
- show quick status for optional modules if configured

Acceptance:

- dashboard loads with meaningful empty states even on first launch
- dashboard does not fail when AI or Google integrations are not configured

### 6.3 Keyword Library

Purpose:

- manage keyword assets in one place

Requirements:

- create, edit, delete keywords
- assign type, priority, notes, and status
- filter by type, priority, and status
- search by keyword text
- bulk update status
- import keywords from text

Acceptance:

- all CRUD operations work locally
- the page remains usable with no external service configuration

### 6.4 Articles

Purpose:

- manage article records and keyword relationships

Requirements:

- create, edit, delete articles
- assign keyword relationships
- mark article status
- store article content locally
- view keyword coverage at the article level

Acceptance:

- articles can be created without AI
- article data persists locally across restarts

### 6.5 GEO Writer

Purpose:

- provide a structured AI-assisted writing workspace for GEO articles

Requirements:

- input primary keyword
- input secondary keywords
- input audience, industry, target market, and article type
- generate structured brief
- generate outline
- generate draft
- support copy or save to article library
- support manual editing after generation

MVP behavior:

- if AI is configured, generation is available
- if AI is not configured, the page still loads and explains what is missing

Acceptance:

- GEO Writer page is accessible without login
- structured draft output is displayed in sections rather than only one long text block

### 6.6 Local Data

Purpose:

- manage the local runtime safely

Requirements:

- export JSON snapshot
- create SQLite backup
- list available backups
- import JSON snapshot
- reset content data
- reset all local data
- open database folder and backup folder in desktop mode where supported

Acceptance:

- local data actions do not require any external service
- clear confirmation is shown before destructive resets

### 6.7 Settings

Purpose:

- centralize local configuration

Requirements:

- language setting
- AI provider settings
- API key guidance
- ranking provider guidance
- indexing credential guidance
- runtime path visibility

Acceptance:

- users can understand what is configured and what is missing
- optional features are explained rather than silently failing

## 7. Non-Functional Requirements

### 7.1 Usability

- no mandatory auth
- clean empty states
- consistent action labels
- low-friction local workflow

### 7.2 Reliability

- core modules must work without AI or Google credentials
- optional modules must degrade gracefully
- local persistence must survive application restarts

### 7.3 Performance

- first load should feel fast on desktop
- list pages should remain responsive with moderate local datasets

### 7.4 Maintainability

- modules should be domain-based
- UI components should share one design system
- routes should stay thin, with business logic moving toward services

## 8. Information Architecture

### Primary Navigation

- Dashboard
- Keywords
- Articles
- GEO Writer
- Local Data
- Settings

### Secondary or Deferred Navigation

- AI Recommend
- AI Analyze
- Google Ranking
- Google Indexing

These deferred items should either be hidden in MVP or visibly marked as advanced modules.

## 9. UI Requirements

The rebuilt UI must follow the style direction of the provided `index.html`.

Required style characteristics:

- left sidebar layout
- sticky top header
- light theme as default
- compact spacing
- clean enterprise tool styling
- tokenized colors and radius values
- soft backgrounds and subtle borders
- reusable card, badge, button, table, form, and modal patterns

The rebuilt UI must not continue the current heavy neon or gradient-heavy visual language as the default product direction.

## 10. Out of Scope for This Rebuild Phase

- multi-user account system
- cloud sync
- public sharing workflows
- billing
- mobile mini-program rebuild
- complete rewrite of all Python integrations

## 11. Success Criteria

The rebuild is successful when:

- app opens without login
- core pages are visually consistent
- keyword, article, GEO draft, and local data flows work locally
- AI and Google modules do not break the app when unconfigured
- the new UI clearly reflects the provided HTML style

## 12. Planned Follow-Up Phases

### Phase 2

- reintroduce AI Recommend
- reintroduce AI Analyze
- connect GEO Writer to persistent draft records

### Phase 3

- reintroduce Google Ranking
- reintroduce Google Indexing
- unify all long-running operations under a job model

### Phase 4

- strengthen desktop packaging
- improve diagnostics
- add more complete automated coverage
