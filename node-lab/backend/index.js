require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'));
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.use('/static', express.static(uploadsDir, { dotfiles: 'deny', index: false }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase().slice(0, 20);
    cb(null, `${crypto.randomUUID()}${extension}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 50 * 1024 * 1024) }
});

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

function publicFile(row) {
  return {
    id: row.id,
    name: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
    createdAt: row.created_at,
    downloadUrl: `/api/files/${row.id}/download`,
    viewUrl: `/static/${encodeURIComponent(row.stored_name)}`
  };
}

app.get('/api/health', async (_req, res) => {
  let database = 'down';
  try {
    await pool.query('SELECT 1');
    database = 'up';
  } catch (_error) {
    // Health still reports service status when PostgreSQL is unavailable.
  }
  res.status(database === 'up' ? 200 : 503).json({
    status: database === 'up' ? 'ok' : 'degraded',
    backend: 'up',
    database
  });
});

app.get('/api/files', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, original_name, stored_name, mime_type, size_bytes, created_at FROM files ORDER BY created_at DESC'
    );
    res.json(rows.map(publicFile));
  } catch (error) {
    next(error);
  }
});

app.post('/api/files', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required.' });
  const id = crypto.randomUUID();
  try {
    const { rows } = await pool.query(
      `INSERT INTO files (id, original_name, stored_name, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, original_name, stored_name, mime_type, size_bytes, created_at`,
      [id, path.basename(req.file.originalname), req.file.filename, req.file.mimetype || 'application/octet-stream', req.file.size]
    );
    res.status(201).json(publicFile(rows[0]));
  } catch (error) {
    await fs.promises.unlink(req.file.path).catch(() => {});
    next(error);
  }
});

app.get('/api/files/:id/download', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT original_name, stored_name, mime_type FROM files WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'File not found.' });
    const filePath = path.join(uploadsDir, rows[0].stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Stored file is missing.' });
    res.type(rows[0].mime_type).download(filePath, rows[0].original_name);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/files/:id', async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'DELETE FROM files WHERE id = $1 RETURNING stored_name',
        [req.params.id]
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'File not found.' });
      }
      await client.query('COMMIT');
      await fs.promises.unlink(path.join(uploadsDir, result.rows[0].stored_name)).catch(() => {});
      res.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large.' });
  }
  console.error(error);
  res.status(500).json({ error: 'Internal server error.' });
});

initializeDatabase()
  .catch((error) => {
    console.error('Unable to initialize PostgreSQL:', error.message);
  })
  .finally(() => {
    app.listen(port, () => console.log(`File manager API listening on http://localhost:${port}`));
  });

module.exports = app;
