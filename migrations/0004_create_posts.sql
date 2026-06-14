CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  title TEXT,
  slug TEXT,
  canonical_path TEXT NOT NULL UNIQUE,
  markdown_body TEXT NOT NULL,
  excerpt TEXT,
  cover_media_id TEXT,
  quote_post_id TEXT,
  status TEXT NOT NULL,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (cover_media_id) REFERENCES media(id),
  FOREIGN KEY (quote_post_id) REFERENCES posts(id)
);

CREATE UNIQUE INDEX idx_posts_public_id ON posts(public_id);
CREATE UNIQUE INDEX idx_posts_user_slug ON posts(user_id, slug);
CREATE UNIQUE INDEX idx_posts_canonical_path ON posts(canonical_path);
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);

CREATE TABLE post_media (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  usage_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (media_id) REFERENCES media(id)
);

CREATE INDEX idx_post_media_post_id ON post_media(post_id);
CREATE INDEX idx_post_media_media_id ON post_media(media_id);
