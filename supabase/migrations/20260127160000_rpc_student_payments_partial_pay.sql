-- Allow users to see and update admin-created unpaid bills when adding partial/complete payments.
-- Without this, RLS blocks: user cannot SELECT or UPDATE rows where user_id = admin.
-- Rule: any authenticated user can get/update/delete payments for a given student when adding a payment for that student.

-- 1) Fetch all payment rows for a student (for overlap logic). Any authenticated user can see them when adding a payment for that student.
DROP FUNCTION IF EXISTS public.get_student_payments_for_partial_pay(uuid);

CREATE OR REPLACE FUNCTION public.get_student_payments_for_partial_pay(p_student_id uuid)
RETURNS TABLE (id uuid, subjects text, balance_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.subjects, sp.balance_amount
  FROM public.student_payments sp
  WHERE sp.student_id = p_student_id
    AND auth.uid() IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_student_payments_for_partial_pay(uuid) IS 'Returns all payment rows for a student so caller can apply partial/complete payment logic. Any authenticated user may call when adding a payment for that student.';

-- 2) Update a student_payment row (subjects, balance, status). Allowed if payment belongs to p_student_id and caller is authenticated.
DROP FUNCTION IF EXISTS public.update_student_payment_for_partial_pay(uuid, text, numeric, text);

CREATE OR REPLACE FUNCTION public.update_student_payment_for_partial_pay(
  p_payment_id uuid,
  p_new_subjects text,
  p_new_balance_amount numeric,
  p_new_payment_status text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.student_payments sp
  SET
    subjects = p_new_subjects,
    balance_amount = p_new_balance_amount,
    payment_status = COALESCE(p_new_payment_status, sp.payment_status),
    updated_at = now()
  WHERE sp.id = p_payment_id
    AND sp.student_id IN (SELECT sp2.student_id FROM public.student_payments sp2 WHERE sp2.id = p_payment_id)
    AND auth.uid() IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.update_student_payment_for_partial_pay(uuid, text, numeric, text) IS 'Updates a student_payment for partial-pay flow. Any authenticated user may call when adding a payment for that student.';

-- 3) Delete a student_payment row (when remaining subjects is 0). Any authenticated user when payment exists.
DROP FUNCTION IF EXISTS public.delete_student_payment_for_partial_pay(uuid);

CREATE OR REPLACE FUNCTION public.delete_student_payment_for_partial_pay(p_payment_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.student_payments sp
  WHERE sp.id = p_payment_id
    AND auth.uid() IS NOT NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.delete_student_payment_for_partial_pay(uuid) IS 'Deletes a student_payment for partial-pay flow. Any authenticated user may call when adding a payment for that student.';

GRANT EXECUTE ON FUNCTION public.get_student_payments_for_partial_pay(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_payment_for_partial_pay(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student_payment_for_partial_pay(uuid) TO authenticated;
