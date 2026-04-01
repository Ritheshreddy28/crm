-- Allow users and admins to delete student_payments so "replace pending with paid" works.
-- Without DELETE policy, the client cannot delete the old pending row when adding a new paid one.

DROP POLICY IF EXISTS "Users can delete own student payments" ON public.student_payments;
DROP POLICY IF EXISTS "Admins can delete student payments" ON public.student_payments;

-- Users: delete only their own rows
CREATE POLICY "Users can delete own student payments"
  ON public.student_payments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins: delete any student payment (for cleanup / replace pending)
-- Use app_metadata only (server-set); user_metadata is editable by users and must not be used for security.
CREATE POLICY "Admins can delete student payments"
  ON public.student_payments
  FOR DELETE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role') = 'admin');
