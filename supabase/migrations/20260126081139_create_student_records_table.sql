/*
  # Create Student Records Table

  1. New Tables
    - `student_records`
      - `id` (uuid, primary key) - Unique identifier for each record
      - `user_id` (uuid, foreign key) - Reference to the user who uploaded the record
      - `student_name` (text) - Name of the student
      - `email` (text) - Student's email address
      - `university` (text) - University name
      - `subjects` (text) - Subjects/courses (can be comma-separated or JSON)
      - `term` (text) - Academic term (e.g., "Fall 2024", "Spring 2025")
      - `additional_info` (jsonb) - Any additional fields from the Excel file
      - `created_at` (timestamptz) - Record creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `student_records` table
    - Users can insert and view their own records
    - Admins can view and edit all records

  3. Important Notes
    - All student data is linked to the user who uploaded it
    - Admins have full access to all student records for management purposes
    - The table supports flexible data structure with additional_info field
*/

-- Create student_records table
CREATE TABLE IF NOT EXISTS student_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_name text NOT NULL,
  email text,
  university text,
  subjects text,
  term text,
  additional_info jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_student_records_user_id ON student_records(user_id);
CREATE INDEX IF NOT EXISTS idx_student_records_created_at ON student_records(created_at DESC);

-- Enable RLS
ALTER TABLE student_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own records
CREATE POLICY "Users can insert own student records"
  ON student_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own records
CREATE POLICY "Users can view own student records"
  ON student_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own records
CREATE POLICY "Users can update own student records"
  ON student_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own records
CREATE POLICY "Users can delete own student records"
  ON student_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Admins can view all records
CREATE POLICY "Admins can view all student records"
  ON student_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins can update all records
CREATE POLICY "Admins can update all student records"
  ON student_records
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Policy: Admins can delete all records
CREATE POLICY "Admins can delete all student records"
  ON student_records
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_student_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_student_records_updated_at ON student_records;
CREATE TRIGGER set_student_records_updated_at
  BEFORE UPDATE ON student_records
  FOR EACH ROW
  EXECUTE FUNCTION update_student_records_updated_at();