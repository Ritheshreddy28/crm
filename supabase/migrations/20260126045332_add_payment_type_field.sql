/*
  # Add Payment Type Field

  ## Changes
  1. Adds a new column `payment_type` to the `payment_records` table
    - Type: text
    - Values: 'Received' or 'Paid'
    - Default: 'Received'
    - NOT NULL constraint to ensure every record has a payment type

  ## Description
  This migration adds a payment_type field to track whether a payment was received
  or paid by the user submitting the record.
*/

-- Add payment_type column to payment_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payment_records' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payment_records 
    ADD COLUMN payment_type text NOT NULL DEFAULT 'Received';
  END IF;
END $$;