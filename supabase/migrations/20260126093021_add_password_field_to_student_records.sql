/*
  # Add password field to student_records table

  1. Changes
    - Add `password` column to `student_records` table
    - Password will be stored as plain text for display purposes

  2. Notes
    - This field stores user credentials for student access
*/

ALTER TABLE student_records ADD COLUMN IF NOT EXISTS password text;
