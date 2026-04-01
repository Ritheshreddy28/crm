/*
  # Payment Records System

  ## Overview
  Creates a complete payment tracking system with role-based access control.
  Normal users can only insert their own payment records.
  Admins can view all payment records.

  ## Tables Created
  1. `payment_records`
    - `id` (uuid, primary key) - Unique identifier for each payment record
    - `user_id` (uuid, foreign key) - References auth.users, tracks who submitted the payment
    - `recipient_name` (text) - Name of the payment recipient
    - `payment_method` (text) - Method used for payment (e.g., Bank Transfer, Credit Card)
    - `payment_currency` (text) - Currency of the payment (e.g., USD, EUR)
    - `payment_date` (date) - Date when the payment was made
    - `receiver_bank_holder` (text) - Name of the bank account holder receiving payment
    - `requirements` (text, nullable) - Optional notes or requirements
    - `payment_screenshot_url` (text) - URL to the uploaded payment screenshot in Supabase Storage
    - `created_at` (timestamptz) - Timestamp when record was created

  ## Security (Row Level Security)
  ### Normal Users (role = 'user')
  - Can INSERT their own payment records
  - CANNOT SELECT/VIEW any payment records (not even their own after submission)
  - CANNOT UPDATE or DELETE any records

  ### Admins (role = 'admin')
  - Can SELECT/VIEW all payment records
  - CANNOT INSERT, UPDATE, or DELETE records (view-only access)

  ## Important Notes
  1. RLS is enabled on all tables
  2. User roles are stored in auth.users.raw_user_meta_data
  3. Default role for new users is 'user'
  4. Storage bucket policies are configured separately
*/

-- Create payment_records table
CREATE TABLE IF NOT EXISTS payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_name text NOT NULL,
  payment_method text NOT NULL,
  payment_currency text NOT NULL,
  payment_date date NOT NULL,
  receiver_bank_holder text NOT NULL,
  requirements text,
  payment_screenshot_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE payment_records ENABLE ROW LEVEL SECURITY;

-- Policy: Normal users can insert their own payment records
CREATE POLICY "Users can insert own payment records"
  ON payment_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND (auth.jwt()->>'role' = 'user' OR auth.jwt()->>'role' IS NULL));

-- Policy: Admins can view all payment records
CREATE POLICY "Admins can view all payment records"
  ON payment_records
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->>'role' = 'admin'));

-- Create index for faster queries on user_id
CREATE INDEX IF NOT EXISTS idx_payment_records_user_id ON payment_records(user_id);

-- Create index for faster queries on created_at
CREATE INDEX IF NOT EXISTS idx_payment_records_created_at ON payment_records(created_at DESC);