-- Add subjects to student_payments so we know which subject(s) the payment is for.
-- Comma-separated list of subject names (e.g. "Math, Physics").

ALTER TABLE student_payments
  ADD COLUMN IF NOT EXISTS subjects text DEFAULT NULL;

COMMENT ON COLUMN student_payments.subjects IS 'Comma-separated subject(s) this payment is for (e.g. Math, Physics).';
