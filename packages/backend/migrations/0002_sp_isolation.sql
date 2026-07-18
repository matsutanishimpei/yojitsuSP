-- SP is a one-way replica of yojitsu-app. Source columns remain untouched by SP edits.
ALTER TABLE students ADD COLUMN last_login_at TEXT;
ALTER TABLE students ADD COLUMN source_managed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE students ADD COLUMN source_deleted_at TEXT;
ALTER TABLE students ADD COLUMN synced_at TEXT;

ALTER TABLE applications ADD COLUMN source_deleted_at TEXT;
ALTER TABLE applications ADD COLUMN synced_at TEXT;

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  last_login_at TEXT,
  source_deleted_at TEXT,
  synced_at TEXT
);

CREATE TABLE IF NOT EXISTS application_overrides (
  application_id INTEGER PRIMARY KEY,
  status TEXT,
  job_title TEXT,
  current_step TEXT,
  steps_json TEXT,
  memo TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_overrides (
  student_id TEXT PRIMARY KEY,
  parent_email TEXT,
  is_completed INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  students_count INTEGER NOT NULL DEFAULT 0,
  applications_count INTEGER NOT NULL DEFAULT 0,
  teachers_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_applications_student_id ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_source_deleted ON applications(source_deleted_at);
