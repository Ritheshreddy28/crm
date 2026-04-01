-- Add email column to future_payments for User Dashboard "Add Future Payment" form.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'future_payments' AND column_name = 'email'
  ) THEN
    ALTER TABLE future_payments ADD COLUMN email text;
  END IF;
END $$;

COMMENT ON COLUMN future_payments.email IS 'Email associated with the future payment (e.g. sender or recipient).';
