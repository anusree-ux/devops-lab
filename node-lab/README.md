# Minimal file manager

React/Vite frontend in `frontend/` and an Express API in `backend/`. The API stores file metadata in PostgreSQL and file contents in `backend/uploads/`.

## Run locally

1. Create a PostgreSQL database, then copy `.env.example` to `.env` and adjust `DATABASE_URL`.
2. Install dependencies: `npm install` and `npm --prefix frontend install`.
3. Run both apps: `npm run dev`.

The UI is at http://localhost:5173. The API listens on `PORT` (default 3000). The backend creates the `files` table on startup.

API endpoints: `GET /api/health`, `GET /api/files`, `POST /api/files` (multipart field `file`), `GET /api/files/:id/download`, and `DELETE /api/files/:id`. `/static/:storedName` is a read-only view route for stored files. Upload names are never used as disk paths; each upload receives a random UUID filename.
