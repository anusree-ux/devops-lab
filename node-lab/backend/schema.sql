CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
