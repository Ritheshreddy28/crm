/*
  # Add password field back to student_records table

  1. Changes
    - Add the `password` column back to the `student_records` table
  
  2. Notes
    - Password will be stored as text
    - Password will only be visible in the student details popup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_records' AND column_name = 'password'
  ) THEN
    ALTER TABLE student_records ADD COLUMN password text;
  END IF;
END $$;
