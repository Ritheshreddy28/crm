/*
  # Create future payments table

  1. New Tables
    - `future_payments`
      - `id` (uuid, primary key) - Unique identifier for each future payment record
      - `user_id` (uuid, foreign key) - References auth.users(id) to track which user submitted
      - `sender_name` (text) - Name of the person/entity sending the payment
      - `amount` (numeric) - Payment amount
      - `category` (text) - Category/type of payment
      - `payment_date` (date) - The future date when payment is expected
      - `notes` (text, optional) - Additional notes about the future payment
      - `created_at` (timestamptz) - When the record was submitted
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `future_payments` table
    - Add policy for users to create their own future payment records
    - Add policy for users to read their own future payment records
    - Add policy for admins to read all future payment records
*/

CREATE TABLE IF NOT EXISTS future_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  category text NOT NULL,
  payment_date date NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE future_payments ENABLE ROW LEVEL SECURITY;

-- Policy for users to insert their own future payments
CREATE POLICY "Users can create own future payments"
  ON future_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to view their own future payments
CREATE POLICY "Users can view own future payments"
  ON future_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for admins to view all future payments
CREATE POLICY "Admins can view all future payments"
  ON future_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_future_payments_user_id ON future_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_future_payments_payment_date ON future_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_future_payments_created_at ON future_payments(created_at DESC);