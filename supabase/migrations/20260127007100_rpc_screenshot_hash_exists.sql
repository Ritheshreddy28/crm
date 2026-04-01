-- RPC to check if a screenshot hash already exists in payment_records or student_payments.
-- Runs with definer rights so it can see all rows (duplicate check must be global).
CREATE OR REPLACE FUNCTION public.screenshot_hash_exists(p_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payment_records WHERE screenshot_hash = p_hash AND p_hash IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM student_payments WHERE screenshot_hash = p_hash AND p_hash IS NOT NULL
  );
$$;

COMMENT ON FUNCTION public.screenshot_hash_exists(text) IS 'Returns true if the given screenshot hash exists in payment_records or student_payments; used to reject duplicate screenshot uploads.';

-- Allow authenticated users to call this (they only get true/false, no row data).
GRANT EXECUTE ON FUNCTION public.screenshot_hash_exists(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.screenshot_hash_exists(text) TO service_role;
