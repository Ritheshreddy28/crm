-- Add status to future_payments so admins can mark payment as done.
-- 'pending' = expected, not yet received. 'done' = marked as received/completed.

ALTER TABLE future_payments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

COMMENT ON COLUMN future_payments.status IS 'pending = expected; done = marked as received/completed.';

-- Ensure existing rows have pending
UPDATE future_payments SET status = 'pending' WHERE status IS NULL;
