# SmartKey Backend

The active backend is the FastAPI cloud-collaboration API. Keywords, articles, GEO drafts, and shared settings use Supabase/Postgres behind authenticated workspace APIs. Rank and indexing job history remain in local SQLite.

## Storage

- Database file: `backend/data/app.db`
- The database schema is created automatically on startup
- No manual SQL setup is required

## Setup

Install Python dependencies from the repository root:

```bash
python -m pip install -r backend/requirements.txt
```

Optional integrations can be configured later in the app settings:

- AI provider API keys, if you want AI features
- SerpAPI, if you want ranking features
- Google credentials, if you want indexing features

## Run

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 3000 --reload
```

Server default: `http://localhost:3000`

## Local capabilities

- Keyword library
- Articles
- GEO writer drafts
- Local data export, import, backup, and reset
- Google ranking job history
- Google indexing job history

## Notes

- Ranking and indexing data are stored locally
- Google-related features still need network access to external APIs
- If you need to reset local rank/indexing history, stop the server and remove `backend/data/app.db`
