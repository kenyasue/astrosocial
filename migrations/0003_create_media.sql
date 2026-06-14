CREATE TABLE media (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  canonical_path TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  original_file_name TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  alt_text TEXT,
  caption TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_media_public_id ON media(public_id);
CREATE UNIQUE INDEX idx_media_canonical_path ON media(canonical_path);
CREATE INDEX idx_media_user_id ON media(user_id);
