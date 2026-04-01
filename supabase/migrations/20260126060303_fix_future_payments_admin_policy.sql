/*
  # Fix admin access to future payments
  
  1. Changes
    - Drop existing admin policy that queries auth.users table
    - Create new policy that checks JWT metadata directly
    - This ensures admins can see all future payments using their session token
  
  2. Security
    - Policy checks auth.jwt() for role = 'admin' in raw_user_meta_data
    - More reliable than querying auth.users table in RLS context
*/

-- Drop the old admin policy
DROP POLICY IF EXISTS "Admins can view all future payments" ON future_payments;

-- Create new policy that checks JWT metadata directly
CREATE POLICY "Admins can view all future payments"
  ON future_payments
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'admin' 
    OR 
    ((auth.jwt()->'user_metadata'->>'role') = 'admin')
    OR
    ((auth.jwt()->'raw_user_meta_data'->>'role') = 'admin')
  );