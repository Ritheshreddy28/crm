/*
  # Remove password field from student_records table

  1. Changes
    - Remove the `password` column from the `student_records` table
  
  2. Notes
    - This operation will permanently delete all password data from student records
    - Password information will no longer be stored for students
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_records' AND column_name = 'password'
  ) THEN
    ALTER TABLE student_records DROP COLUMN password;
  END IF;
END $$;
