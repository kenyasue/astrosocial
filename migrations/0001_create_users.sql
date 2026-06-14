CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_media_id TEXT,
  cover_media_id TEXT,
  website_url TEXT,
  location TEXT,
  dm_policy TEXT NOT NULL DEFAULT 'everyone',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
