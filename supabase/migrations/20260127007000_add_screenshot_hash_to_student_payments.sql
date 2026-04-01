-- Store screenshot hash in student_payments so we can reject duplicate screenshot uploads (same image).
ALTER TABLE student_payments
  ADD COLUMN IF NOT EXISTS screenshot_hash text;

COMMENT ON COLUMN student_payments.screenshot_hash IS 'SHA-256 hash of the payment screenshot file; used to detect duplicate screenshot submissions.';

CREATE INDEX IF NOT EXISTS idx_student_payments_screenshot_hash
  ON student_payments (screenshot_hash)
  WHERE screenshot_hash IS NOT NULL;
