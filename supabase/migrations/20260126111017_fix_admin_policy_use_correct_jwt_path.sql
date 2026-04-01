/*
  # Fix Admin Policy to Use Correct JWT Path

  1. Changes
    - Drop previous admin policy that used incorrect JWT path
    - Create new admin policy that accesses role from user_metadata in JWT
    - In Supabase, raw_user_meta_data is available in JWT as user_metadata

  2. Security
    - Admins with role='admin' in user_metadata can view all student payments
    - Regular users can only view their own student payments
*/

-- Drop the existing admin policy
DROP POLICY IF EXISTS "Admins can view all student payments" ON student_payments;

-- Create new admin policy using correct JWT path
CREATE POLICY "Admins can view all student payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->'user_metadata'->>'role')::text = 'admin'
  );
