/*
  # Fix student_payments RLS for user inserts

  Problem:
    - App shows "new row violates row-level security policy" when inserting into `student_payments`.
    - This typically means the INSERT RLS policy is missing or incorrect in the Supabase project.

  Solution:
    - Ensure RLS is enabled
    - Recreate user policies (SELECT/INSERT/UPDATE) based on auth.uid() = user_id
    - Keep admin SELECT policy based on JWT user_metadata.role = 'admin'
*/

-- Ensure RLS is enabled
ALTER TABLE IF EXISTS public.student_payments ENABLE ROW LEVEL SECURITY;

-- Drop potentially-mismatched policies (safe if they don't exist)
DROP POLICY IF EXISTS "Users can view own student payments" ON public.student_payments;
DROP POLICY IF EXISTS "Users can insert own student payments" ON public.student_payments;
DROP POLICY IF EXISTS "Users can update own student payments" ON public.student_payments;
DROP POLICY IF EXISTS "Admin can view all student payments" ON public.student_payments;
DROP POLICY IF EXISTS "Admins can view all student payments" ON public.student_payments;

-- Users: read their own rows
CREATE POLICY "Users can view own student payments"
  ON public.student_payments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users: insert only rows for themselves
CREATE POLICY "Users can insert own student payments"
  ON public.student_payments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users: update only their own rows
CREATE POLICY "Users can update own student payments"
  ON public.student_payments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins: view all rows (role stored in user_metadata.role)
CREATE POLICY "Admins can view all student payments"
  ON public.student_payments
  FOR SELECT
  TO authenticated
  USING ((auth.jwt()->'user_metadata'->>'role')::text = 'admin');

