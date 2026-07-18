CREATE TABLE IF NOT EXISTS sp_teacher_credentials (
  teacher_id TEXT PRIMARY KEY,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  password_hash TEXT NOT NULL,
  upgraded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
