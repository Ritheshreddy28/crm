-- Add is_critical flag to student_records so admins can mark/unmark problematic students.

ALTER TABLE student_records
  ADD COLUMN IF NOT EXISTS is_critical boolean DEFAULT false;

COMMENT ON COLUMN student_records.is_critical IS 'When true, student is marked as critical/problematic by admin.';
