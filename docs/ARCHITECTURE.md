# Architecture

## Overview

SmartKey is a local-first SEO and GEO content workbench delivered as a desktop-first application with a web-compatible runtime.

The system is designed to unify:

- keyword planning
- AI-assisted analysis and writing
- article drafting and management
- Google ranking checks
- Google indexing operations
- local backup, import, export, and reset workflows

The target product form is one application built around a single operating flow:

`keyword discovery -> content planning -> GEO writing -> article management -> ranking/indexing operations -> local data management`

## System Context

At runtime, the application is structured as:

`Electron or Browser -> React UI -> FastAPI -> SQLite / Python adapters / External AI APIs / Google APIs`

This keeps the user interface, business logic, local persistence, and external integrations clearly separated.

## Architectural Principles

1. Local-first by default  
   User data, articles, keywords, task history, and settings are stored locally in SQLite unless a future sync feature is explicitly introduced.

2. Backend as orchestration layer  
   All business workflows, AI prompting, external API calls, and Python task execution pass through the FastAPI backend.

3. Structured workflows over raw utilities  
   Features such as GEO writing return structured artifacts like briefs, outlines, drafts, FAQs, and metadata instead of unstructured text blobs.

4. Desktop-first packaging with web compatibility  
   The product runs as a normal web app during development and as an Electron desktop app for end users.

5. Clear domain boundaries  
   Keywords, articles, AI, SEO operations, and local data management remain distinct modules with well-defined ownership.

## Layered Architecture

### 1. Shell Layer

- `desktop/`
  Electron desktop shell
- browser runtime
  Standard web runtime for development and debugging

Responsibilities:

- create the application window
- start and supervise the backend process
- provide desktop-only integrations such as opening local folders
- manage runtime data directories for packaged desktop use

### 2. Presentation Layer

- `frontend/`
  React + TypeScript + Vite

Responsibilities:

- routing and navigation
- page rendering
- forms and local interaction state
- language switching
- visual status and task result display
- calling backend APIs via shared service clients

The frontend does not call external AI providers, Google services, or Python scripts directly.

### 3. Application Layer

- `backend/routers/`
- `backend/services/`
- shared request middleware and utilities in `backend/`

Responsibilities:

- request validation
- workflow orchestration
- prompt construction and AI response handling
- task creation and persistence
- translation of product requests into Python or external API operations
- observability, health checks, and diagnostics

Routes stay thin. Reusable business logic belongs in service modules.

### 4. Capability and Persistence Layer

- `backend/db.py`
  SQLite access and schema bootstrap
- `backend/python/`
  Python bridge scripts used by the backend
- `tools/`
  external or imported capability modules used by adapters

Responsibilities:

- persist local business data
- execute ranking and indexing workflows
- store and retrieve task history
- support local backup and restore

## Core Domains

### Keywords

Purpose:

- keyword CRUD
- classification
- prioritization
- workflow state management

### Articles

Purpose:

- article CRUD
- article-to-keyword relationship tracking
- draft and publish status management

### AI

Purpose:

- keyword recommendation
- keyword analysis
- GEO article generation

### SEO Operations

Purpose:

- Google ranking jobs
- indexing inspection jobs
- indexing submission jobs

### Local Data

Purpose:

- export
- import
- backup
- reset
- filesystem helpers

## Data Architecture

SQLite is the system of record for local product data.

Current or expected logical entities:

- `keywords`
- `articles`
- `rank_jobs`
- `rank_results`
- `indexing_jobs`
- `indexing_pages`
- `geo_article_drafts`
- `app_settings`

## Testing Strategy

The project uses multiple test layers:

- frontend static checks
- backend syntax checks
- API tests with isolated SQLite data
- backend-served production smoke tests
- browser-free production route smoke checks
- packaging smoke checks
- documentation reality checks

## Decision Summary

SmartKey should be treated as:

- a local-first SEO and GEO operations platform
- a desktop-first product with web-compatible development
- a React frontend over a FastAPI application layer
- a SQLite-backed local data system
- a backend-orchestrated integration point for AI, Python tooling, and Google services
