/*
  # Fix Admin Student Payments RLS Policy

  1. Changes
    - Drop existing admin policy for student_payments
    - Create new simplified admin policy using auth.jwt()
    - This approach is more reliable for checking user roles

  2. Security
    - Admins with role='admin' in raw_user_meta_data can view all student payments
    - Regular users can only view their own student payments
*/

-- Drop the existing admin policy
DROP POLICY IF EXISTS "Admins can view all student payments" ON student_payments;

-- Create new admin policy using auth.jwt() which is more reliable
CREATE POLICY "Admins can view all student payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'role')::text = 'admin'
  );
