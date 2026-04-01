-- Add payment_screenshot_urls (jsonb array) to store multiple screenshots when partial payments are combined.
-- Also update the RPC to return more columns needed for merging.

ALTER TABLE student_payments
  ADD COLUMN IF NOT EXISTS payment_screenshot_urls jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN student_payments.payment_screenshot_urls IS 'Array of screenshot URLs for this payment (when multiple partial payments are combined into one complete payment).';

-- Migrate existing single screenshot to the array (if not already there)
UPDATE student_payments
SET payment_screenshot_urls = jsonb_build_array(payment_screenshot_url)
WHERE payment_screenshot_url IS NOT NULL
  AND payment_screenshot_url <> ''
  AND (payment_screenshot_urls IS NULL OR payment_screenshot_urls = '[]'::jsonb);

-- Update get_student_payments_for_partial_pay to return more columns (amount, screenshot URLs)
DROP FUNCTION IF EXISTS public.get_student_payments_for_partial_pay(uuid);

CREATE OR REPLACE FUNCTION public.get_student_payments_for_partial_pay(p_student_id uuid)
RETURNS TABLE (
  id uuid,
  subjects text,
  balance_amount numeric,
  amount numeric,
  payment_screenshot_url text,
  payment_screenshot_urls jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.id,
    sp.subjects,
    sp.balance_amount,
    sp.amount,
    sp.payment_screenshot_url,
    sp.payment_screenshot_urls
  FROM public.student_payments sp
  WHERE sp.student_id = p_student_id
    AND auth.uid() IS NOT NULL;
$$;

COMMENT ON FUNCTION public.get_student_payments_for_partial_pay(uuid) IS 'Returns all payment rows for a student including amount and screenshots, so caller can merge when completing partial payment.';

-- Add RPC to update payment in-place when completing partial (merge amounts and screenshots)
DROP FUNCTION IF EXISTS public.merge_student_payment_complete(uuid, numeric, numeric, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.merge_student_payment_complete(
  p_payment_id uuid,
  p_add_amount numeric,
  p_new_balance_amount numeric,
  p_new_payment_status text,
  p_new_screenshot_url text DEFAULT NULL,
  p_existing_screenshot_urls jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
  v_merged_urls jsonb;
BEGIN
  -- Merge existing screenshots with new one (if provided)
  v_merged_urls := COALESCE(p_existing_screenshot_urls, '[]'::jsonb);
  IF p_new_screenshot_url IS NOT NULL AND p_new_screenshot_url <> '' THEN
    v_merged_urls := v_merged_urls || jsonb_build_array(p_new_screenshot_url);
  END IF;

  UPDATE public.student_payments sp
  SET
    amount = sp.amount + p_add_amount,
    balance_amount = p_new_balance_amount,
    payment_status = p_new_payment_status,
    payment_screenshot_urls = v_merged_urls,
    updated_at = now()
  WHERE sp.id = p_payment_id
    AND auth.uid() IS NOT NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.merge_student_payment_complete(uuid, numeric, numeric, text, text, jsonb) IS 'Merges a new payment into an existing partial payment row: adds amounts, updates balance/status, merges screenshots.';

GRANT EXECUTE ON FUNCTION public.get_student_payments_for_partial_pay(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_student_payment_complete(uuid, numeric, numeric, text, text, jsonb) TO authenticated;
