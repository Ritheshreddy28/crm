-- Add Payment Amount Field and Fix RLS Policy
-- 
-- Overview:
-- Adds payment_amount column to store transaction amounts
-- Fixes RLS policy to allow both users and admins to submit payment records
-- 
-- Changes:
-- 1. Add payment_amount column (numeric type for precise decimal values)
-- 2. Drop existing restrictive INSERT policy
-- 3. Create new INSERT policy that allows all authenticated users to insert their own records
-- 
-- Important Notes:
-- - Payment amounts stored as numeric for accuracy
-- - Both regular users and admins can now submit payment records
-- - Users can only insert records with their own user_id

-- Add payment_amount column
ALTER TABLE payment_records 
ADD COLUMN IF NOT EXISTS payment_amount numeric NOT NULL DEFAULT 0;

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can insert own payment records" ON payment_records;

-- Create new policy that allows all authenticated users (including admins) to insert
CREATE POLICY "Authenticated users can insert own payment records"
  ON payment_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);