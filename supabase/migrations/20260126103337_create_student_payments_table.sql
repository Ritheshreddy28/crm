/*
  # Create student_payments table

  1. New Tables
    - `student_payments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users) - The user recording the payment
      - `student_id` (uuid, foreign key to student_records) - The student making the payment
      - `payment_mode` (text) - Payment method (Bank Transfer, UPI, Cash, etc.)
      - `currency` (text) - Currency code (USD, INR, etc.)
      - `amount` (numeric) - Total amount to be paid
      - `payment_status` (text) - Status: paid_completely, paid_partially, unpaid
      - `balance_amount` (numeric) - Remaining balance amount
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on `student_payments` table
    - Add policy for authenticated users to read their own payment records
    - Add policy for authenticated users to insert their own payment records
    - Add policy for authenticated users to update their own payment records
    - Add policy for admin users to read all payment records
*/

CREATE TABLE IF NOT EXISTS student_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  student_id uuid REFERENCES student_records(id) ON DELETE CASCADE NOT NULL,
  payment_mode text NOT NULL,
  currency text NOT NULL,
  amount numeric NOT NULL,
  payment_status text NOT NULL CHECK (payment_status IN ('paid_completely', 'paid_partially', 'unpaid')),
  balance_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own student payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own student payments"
  ON student_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own student payments"
  ON student_payments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all student payments"
  ON student_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_student_payments_user_id ON student_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_student_payments_student_id ON student_payments(student_id);