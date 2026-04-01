/*
  # Fix Admin Storage Policy for Payment Screenshots

  1. Changes
    - Drop the existing admin storage policy that checks role incorrectly
    - Create a new policy that properly checks user_metadata for admin role
    
  2. Security
    - Admins (users with role='admin' in user_metadata) can view all payment screenshots
    - Regular users can upload their own screenshots (existing policy unchanged)
*/

-- Drop the old incorrect policy
DROP POLICY IF EXISTS "Admins can view all payment screenshots" ON storage.objects;

-- Create the correct policy that checks user_metadata
CREATE POLICY "Admins can view all payment screenshots"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots' 
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );
