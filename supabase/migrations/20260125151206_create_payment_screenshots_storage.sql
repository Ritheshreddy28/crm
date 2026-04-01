-- Payment Screenshots Storage Bucket
-- 
-- Overview:
-- Creates a storage bucket for payment screenshot uploads with proper access control.
-- 
-- Bucket:
-- - Name: payment-screenshots
-- - Public: false (private bucket)
-- 
-- Storage Policies:
-- - Authenticated Users: Can INSERT/UPLOAD files to their own folder (user_id/*)
-- - Admins: Can SELECT/VIEW all files in the bucket
-- 
-- Important Notes:
-- 1. Files are organized by user_id folders
-- 2. Only authenticated users can upload
-- 3. Only admins can view/download files
-- 4. Normal users cannot view files after upload

-- Create storage bucket for payment screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-screenshots',
  'payment-screenshots',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload files to their own folder
CREATE POLICY "Users can upload payment screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'payment-screenshots' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Admins can view all payment screenshots
CREATE POLICY "Admins can view all payment screenshots"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots' AND
    (auth.jwt()->>'role' = 'admin')
  );