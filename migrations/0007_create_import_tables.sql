CREATE TABLE import_jobs (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_name TEXT,
  status TEXT NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  options_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE import_logs (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);

CREATE INDEX idx_import_logs_job_id ON import_logs(import_job_id);

CREATE TABLE import_mappings (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(import_job_id, source_type, source_id),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id)
);
