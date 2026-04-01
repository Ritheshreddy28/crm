/*
  # Add admin delete policies
  
  1. Changes
    - Add DELETE policy for admins on payment_records table
    - Add DELETE policy for admins on future_payments table
    - Admins can delete any record from both tables
  
  2. Security
    - Only users with role = 'admin' in their JWT can delete
    - Checks multiple JWT metadata locations for compatibility
*/

-- Policy for admins to delete payment records
CREATE POLICY "Admins can delete payment records"
  ON payment_records
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'admin' 
    OR 
    ((auth.jwt()->'user_metadata'->>'role') = 'admin')
    OR
    ((auth.jwt()->'raw_user_meta_data'->>'role') = 'admin')
  );

-- Policy for admins to delete future payments
CREATE POLICY "Admins can delete future payments"
  ON future_payments
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt()->>'role') = 'admin' 
    OR 
    ((auth.jwt()->'user_metadata'->>'role') = 'admin')
    OR
    ((auth.jwt()->'raw_user_meta_data'->>'role') = 'admin')
  );