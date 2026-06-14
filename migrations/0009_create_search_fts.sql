-- Full-text search over posts (title + body), kept in sync by triggers.
CREATE VIRTUAL TABLE posts_fts USING fts5(post_id UNINDEXED, title, body);

CREATE TRIGGER posts_fts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts (post_id, title, body)
  VALUES (new.id, COALESCE(new.title, ''), new.markdown_body);
END;

CREATE TRIGGER posts_fts_au AFTER UPDATE ON posts BEGIN
  UPDATE posts_fts SET title = COALESCE(new.title, ''), body = new.markdown_body
  WHERE post_id = new.id;
END;

CREATE TRIGGER posts_fts_ad AFTER DELETE ON posts BEGIN
  DELETE FROM posts_fts WHERE post_id = old.id;
END;

-- Backfill any posts that existed before this migration.
INSERT INTO posts_fts (post_id, title, body)
SELECT id, COALESCE(title, ''), markdown_body FROM posts;
