/*
  # Add credited_to, payment_date, and payment_screenshot_url to student_payments

  1. Changes
    - Add `credited_to` column (text) - Who the payment was credited to
    - Add `payment_date` column (date) - Date of the payment
    - Add `payment_screenshot_url` column (text) - URL to the payment screenshot

  2. Notes
    - All new columns are nullable to maintain backward compatibility
    - Existing records will have NULL values for these fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_payments' AND column_name = 'credited_to'
  ) THEN
    ALTER TABLE student_payments ADD COLUMN credited_to text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_payments' AND column_name = 'payment_date'
  ) THEN
    ALTER TABLE student_payments ADD COLUMN payment_date date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_payments' AND column_name = 'payment_screenshot_url'
  ) THEN
    ALTER TABLE student_payments ADD COLUMN payment_screenshot_url text;
  END IF;
END $$;
