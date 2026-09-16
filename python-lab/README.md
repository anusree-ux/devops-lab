# Minimal file manager

A small React/Vite frontend and Flask backend with MySQL metadata and local file storage.

## Setup

1. Create a MySQL database/user by adapting `backend/schema.sql`, then copy `backend/.env.example` to `backend/.env` and set credentials.
2. From `backend`, install dependencies and run:
   `python -m venv .venv`, activate it, `pip install -r requirements.txt`, `python app.py`
3. From `frontend`, run `npm install` and `npm run dev`, then open <http://localhost:5173>.

The backend creates its `files` table on startup. Uploaded bytes are stored in `backend/uploads`; only metadata is stored in MySQL. The default upload limit is 50 MiB. API endpoints include `/api/health`, `/api/db-status`, and CRUD file routes.
