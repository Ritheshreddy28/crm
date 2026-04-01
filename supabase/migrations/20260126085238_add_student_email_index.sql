/*
  # Add Index for Student Email Lookups

  1. Changes
    - Add index on email column in student_records table for faster duplicate detection
    - This supports efficient querying when checking for existing students during Excel uploads
  
  2. Important Notes
    - Improves performance when grouping students by email
    - Enables faster duplicate detection during bulk uploads
*/

-- Add index for email column to support duplicate detection
CREATE INDEX IF NOT EXISTS idx_student_records_email ON student_records(email);
