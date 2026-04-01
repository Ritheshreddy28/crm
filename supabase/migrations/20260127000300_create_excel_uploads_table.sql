/*
  # Create excel_uploads table and storage bucket

  Purpose:
    - Track all Excel file uploads (from both admin and user dashboards)
    - Store metadata about uploaded files
    - Link to storage bucket for file retrieval

  Tables:
    - `excel_uploads`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users) - Who uploaded it
      - `file_name` (text) - Original filename
      - `file_path` (text) - Path in storage bucket
      - `file_size` (bigint) - File size in bytes
      - `upload_type` (text) - 'admin' or 'user'
      - `records_count` (integer) - Number of records processed
      - `created_at` (timestamptz)
  
  Storage:
    - Bucket: `excel-uploads` (private)
    - Users can upload to their own folder
    - Admins can view all files
  
  Security:
    - Enable RLS
    - Users can view their own uploads
    - Admins can view all uploads
*/

-- Create storage bucket for Excel uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'excel-uploads',
  'excel-uploads',
  false,
  10485760,
  ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv', 'application/vnd.oasis.opendocument.spreadsheet']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload Excel files to their own folder
CREATE POLICY "Users can upload excel files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'excel-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Users can view their own Excel files
CREATE POLICY "Users can view own excel files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'excel-uploads' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Admins can view all Excel files
CREATE POLICY "Admins can view all excel files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'excel-uploads' AND
    (auth.jwt()->'user_metadata'->>'role')::text = 'admin'
  );

-- Create excel_uploads table
CREATE TABLE IF NOT EXISTS excel_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL,
  upload_type text NOT NULL CHECK (upload_type IN ('admin', 'user')),
  records_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE excel_uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own uploads
CREATE POLICY "Users can view own excel uploads"
  ON excel_uploads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own uploads
CREATE POLICY "Users can insert own excel uploads"
  ON excel_uploads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all uploads
CREATE POLICY "Admins can view all excel uploads"
  ON excel_uploads FOR SELECT
  TO authenticated
  USING ((auth.jwt()->'user_metadata'->>'role')::text = 'admin');

CREATE INDEX IF NOT EXISTS idx_excel_uploads_user_id ON excel_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_excel_uploads_created_at ON excel_uploads(created_at DESC);
