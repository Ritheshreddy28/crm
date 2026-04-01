/*
  # Fix Student Payments Admin RLS Policy

  1. Changes
    - Drop incorrect admin policy that checks raw_app_meta_data
    - Create correct admin policy that checks raw_user_meta_data
    
  2. Security
    - Admins can now properly view all student payment records
    - Uses the same pattern as student_records table
*/

-- Drop the incorrect admin policy
DROP POLICY IF EXISTS "Admin can view all student payments" ON student_payments;

-- Create correct admin policy that checks raw_user_meta_data instead of raw_app_meta_data
CREATE POLICY "Admins can view all student payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );