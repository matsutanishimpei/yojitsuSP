DELETE FROM application_overrides;
DELETE FROM source_applications_stage;
DELETE FROM applications WHERE id=900001;
DELETE FROM students WHERE id='SYNC_TEST';

INSERT INTO students (id, name, parent_birthday, source_managed)
VALUES ('SYNC_TEST', '同期テスト', '0101', 1);

INSERT INTO source_applications_stage
  (id, student_id, company_name, status, current_step, steps_json, memo, updated_at)
VALUES (900001, 'SYNC_TEST', '同期元企業', '予定', '説明会', '[]', 'appメモ1', CURRENT_TIMESTAMP);

INSERT INTO applications
  (id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, source_deleted_at, synced_at)
SELECT id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, NULL, CURRENT_TIMESTAMP
FROM source_applications_stage WHERE 1
ON CONFLICT(id) DO UPDATE SET memo=excluded.memo, synced_at=CURRENT_TIMESTAMP;

INSERT INTO application_overrides (application_id, memo) VALUES (900001, 'SPメモ');
UPDATE source_applications_stage SET memo='appメモ2' WHERE id=900001;

INSERT INTO applications
  (id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, source_deleted_at, synced_at)
SELECT id, student_id, company_name, job_title, hojin_number, status, current_step, steps_json, memo, updated_at, NULL, CURRENT_TIMESTAMP
FROM source_applications_stage WHERE 1
ON CONFLICT(id) DO UPDATE SET memo=excluded.memo, synced_at=CURRENT_TIMESTAMP;
