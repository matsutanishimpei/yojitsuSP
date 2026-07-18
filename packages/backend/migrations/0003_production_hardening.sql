CREATE TABLE IF NOT EXISTS source_students_stage (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_birthday TEXT,
  parent_email TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS source_applications_stage (
  id INTEGER PRIMARY KEY,
  student_id TEXT NOT NULL,
  company_name TEXT NOT NULL,
  job_title TEXT,
  hojin_number TEXT,
  status TEXT,
  current_step TEXT,
  steps_json TEXT,
  memo TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS source_teachers_stage (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_lock (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  locked_at TEXT,
  run_id INTEGER
);
INSERT OR IGNORE INTO sync_lock (id) VALUES (1);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_key TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identity_time
  ON login_attempts(identity_key, attempted_at);
