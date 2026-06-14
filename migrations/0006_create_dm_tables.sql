CREATE TABLE dm_conversations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE dm_conversation_members (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(conversation_id, user_id),
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE dm_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL,
  body TEXT NOT NULL,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES dm_conversations(id),
  FOREIGN KEY (sender_user_id) REFERENCES users(id)
);

CREATE INDEX idx_dm_messages_conversation_id ON dm_messages(conversation_id);
