-- Store a hash of each payment screenshot so we can reject duplicate screenshot submissions (same image file).
ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS screenshot_hash text;

COMMENT ON COLUMN payment_records.screenshot_hash IS 'SHA-256 hash of the screenshot file; used to detect duplicate screenshot submissions.';

CREATE INDEX IF NOT EXISTS idx_payment_records_screenshot_hash
  ON payment_records (user_id, screenshot_hash)
  WHERE screenshot_hash IS NOT NULL;
