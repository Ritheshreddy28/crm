/*
  # Add Phone Number to Student Records

  1. Changes
    - Add `phone_number` column to `student_records` table
      - Type: text
      - Nullable: true (optional field)
      - Used to store student contact information

  2. Important Notes
    - Phone numbers are optional and can be provided during student record creation
    - Existing records will have NULL values for phone_number by default
*/

-- Add phone_number column to student_records table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'student_records' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE student_records ADD COLUMN phone_number text;
  END IF;
END $$;