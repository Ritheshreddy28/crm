/*
  # Fix Admin RLS Policy for Student Records

  1. Changes
    - Drop the existing admin policies that check role incorrectly
    - Create new policies that properly check user_metadata for admin role using JWT
    
  2. Security
    - Admins (users with role='admin' in user_metadata) can view, update, and delete all student records
    - Regular users can manage only their own records (existing policies unchanged)
*/

-- Drop the old incorrect admin policies
DROP POLICY IF EXISTS "Admins can view all student records" ON student_records;
DROP POLICY IF EXISTS "Admins can update all student records" ON student_records;
DROP POLICY IF EXISTS "Admins can delete all student records" ON student_records;

-- Create the correct policy for admins to view all records
CREATE POLICY "Admins can view all student records"
  ON student_records
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Create the correct policy for admins to update all records
CREATE POLICY "Admins can update all student records"
  ON student_records
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

-- Create the correct policy for admins to delete all records
CREATE POLICY "Admins can delete all student records"
  ON student_records
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );