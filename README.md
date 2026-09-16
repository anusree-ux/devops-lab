# DevOps Practice Lab

This repository contains two minimal file manager applications with the same features and different backend stacks.

## Node lab

- React/Vite frontend in `node-lab/frontend`
- Node.js/Express backend in `node-lab/backend`
- PostgreSQL stores file metadata
- `node-lab/backend/uploads` stores uploaded file contents

Create a PostgreSQL database, copy `node-lab/.env.example` to `node-lab/.env`, and set `DATABASE_URL`. Then run:

```text
cd node-lab
npm install
npm --prefix frontend install
npm run dev
```

Open `http://localhost:5173`.

## Python lab

- React/Vite frontend in `python-lab/frontend`
- Python/Flask backend in `python-lab/backend`
- MySQL stores file metadata
- `python-lab/backend/uploads` stores uploaded file contents

Create the database and user using `python-lab/backend/schema.sql`, copy `.env.example` to `.env`, and set the MySQL values. Then run the backend:

```text
cd python-lab/backend
python -m venv .venv
python -m pip install -r requirements.txt
python app.py
```

In another terminal, run the frontend:

```text
cd python-lab/frontend
npm install
npm run dev
```

Open the URL printed by Vite.

Both applications support uploading, listing, viewing, downloading, and deleting files, along with backend and database status indicators.
