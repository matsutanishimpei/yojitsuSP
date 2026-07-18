ALTER TABLE teachers ADD COLUMN source_managed INTEGER NOT NULL DEFAULT 1;
ALTER TABLE teachers ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE teachers ADD COLUMN created_by TEXT;

-- Shared/default administrator IDs must never remain usable when a named teacher exists.
UPDATE teachers
SET is_active = 0
WHERE lower(id) IN ('admin', 'administrator', 'root')
  AND EXISTS (
    SELECT 1 FROM teachers named
    WHERE lower(named.id) NOT IN ('admin', 'administrator', 'root')
      AND named.source_deleted_at IS NULL
  );

CREATE TABLE IF NOT EXISTS teacher_account_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'enabled', 'disabled')),
  actor_teacher_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_teacher_account_events_teacher
  ON teacher_account_events(teacher_id, occurred_at);
