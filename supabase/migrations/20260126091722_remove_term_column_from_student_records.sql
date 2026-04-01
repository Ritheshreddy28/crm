/*
  # Remove term column from student_records table

  1. Changes
    - Drop the `term` column from `student_records` table
    - Term information is now embedded within subjects (e.g., fall_1_maths)

  2. Notes
    - Existing data in the term column will be permanently removed
    - Subject names should already contain term information
*/

ALTER TABLE student_records DROP COLUMN IF EXISTS term;
