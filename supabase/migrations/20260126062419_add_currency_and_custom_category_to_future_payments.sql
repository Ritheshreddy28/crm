/*
  # Add currency and custom category to future payments
  
  1. Changes
    - Add `currency` column to future_payments table (default 'USD')
    - Add `custom_category` column to future_payments table for when category is 'Other'
  
  2. Notes
    - Currency stores the selected currency code (USD, INR, EUR, GBP, etc.)
    - Custom category is only used when category field is set to 'Other'
    - Both fields have default values to maintain backward compatibility
*/

-- Add currency column with default value
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'future_payments' AND column_name = 'currency'
  ) THEN
    ALTER TABLE future_payments ADD COLUMN currency text DEFAULT 'USD';
  END IF;
END $$;

-- Add custom_category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'future_payments' AND column_name = 'custom_category'
  ) THEN
    ALTER TABLE future_payments ADD COLUMN custom_category text DEFAULT '';
  END IF;
END $$;