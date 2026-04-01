/*
  # Add UTR Number Field to Payment Records

  ## Overview
  Adds a UTR (Unique Transaction Reference) number field to track payment transaction references.

  ## Changes
  1. Add `utr_number` column to `payment_records` table
     - Type: text (optional field)
     - Description: Unique transaction reference number from payment gateway/bank

  ## Important Notes
  - This field is optional as not all payment methods provide UTR numbers
  - Existing records will have NULL values for this field
*/

-- Add UTR number column to payment_records
ALTER TABLE payment_records 
ADD COLUMN IF NOT EXISTS utr_number text;
