# SmartKey Backend

The backend now uses local SQLite storage instead of Supabase.

## Storage

- Database file: `backend/data/app.db`
- The database schema is created automatically on startup
- No manual SQL setup is required

## Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and set at least:

- `JWT_SECRET`
- `MINIMAX_API_KEY` if you want AI features

## Run

```bash
npm run dev
```

Server default: `http://localhost:3000`

## Local capabilities

- User registration and login
- Keyword library
- Articles
- Google ranking job history
- Google indexing job history

## Notes

- Ranking and indexing data are stored locally
- Google-related features still need network access to external APIs
- If you need to reset local data, stop the server and remove `backend/data/app.db`
