/*
  # Fix Admin RLS Policy for Payment Records

  1. Changes
    - Drop the existing admin policy that checks role incorrectly
    - Create a new policy that properly checks user_metadata for admin role
    
  2. Security
    - Admins (users with role='admin' in user_metadata) can view all payment records
    - Regular users can only insert their own records (existing policy unchanged)
*/

-- Drop the old incorrect policy
DROP POLICY IF EXISTS "Admins can view all payment records" ON payment_records;

-- Create the correct policy that checks user_metadata
CREATE POLICY "Admins can view all payment records"
  ON payment_records
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
