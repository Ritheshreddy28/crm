-- RPC for reminder cron: returns students with unpaid or partially paid payments only.
-- Only rows with payment_status in ('unpaid','paid_partially') and balance_amount > 0.
-- "subjects" returned are only the partial/unpaid subjects for this row (excludes subjects already paid_completely).
-- Each email row = one payment; store only that payment's subject(s) in student_payments.subjects for one subject per line.

DROP FUNCTION IF EXISTS public.get_student_reminder_recipients();

CREATE OR REPLACE FUNCTION public.get_student_reminder_recipients()
RETURNS TABLE (
  email text,
  student_name text,
  subjects text,
  payment_status text,
  balance_amount numeric,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH paid_subjects_per_student AS (
    SELECT
      sp2.student_id,
      lower(trim(unnest(string_to_array(coalesce(sp2.subjects, ''), ',')))) AS subj
    FROM public.student_payments sp2
    WHERE sp2.payment_status = 'paid_completely'
      AND sp2.subjects IS NOT NULL
      AND trim(sp2.subjects) <> ''
  ),
  pending_rows AS (
    SELECT
      sr.id AS student_id,
      sr.email,
      sr.student_name,
      sp.id AS payment_id,
      sp.subjects AS raw_subjects,
      sp.payment_status,
      sp.balance_amount,
      sp.currency,
      sp.updated_at
    FROM public.student_records sr
    JOIN public.student_payments sp ON sp.student_id = sr.id
    WHERE sr.email IS NOT NULL AND trim(sr.email) <> ''
      AND sp.balance_amount > 0
      AND sp.payment_status IN ('unpaid', 'paid_partially')
  ),
  computed AS (
    SELECT
      pr.email::text AS email,
      pr.student_name::text AS student_name,
      coalesce(
        nullif(
          trim(
            (SELECT string_agg(t.subj, ', ' ORDER BY t.subj)
             FROM (
               SELECT DISTINCT trim(s) AS subj
               FROM unnest(string_to_array(coalesce(pr.raw_subjects, ''), ',')) AS s
               WHERE trim(s) <> ''
                 AND lower(trim(s)) NOT IN (
                   SELECT ps.subj FROM paid_subjects_per_student ps WHERE ps.student_id = pr.student_id
                 )
             ) t)
          ),
          ''
        ),
        '—'
      )::text AS subjects,
      pr.payment_status::text AS payment_status,
      pr.balance_amount,
      coalesce(pr.currency, 'INR')::text AS currency
    FROM pending_rows pr
  )
  SELECT c.email, c.student_name, c.subjects, c.payment_status, c.balance_amount, c.currency
  FROM computed c
  WHERE trim(coalesce(c.subjects, '')) <> '' AND c.subjects <> '—'
  ORDER BY c.email, c.payment_status, c.balance_amount;
$$;

COMMENT ON FUNCTION public.get_student_reminder_recipients() IS 'Returns students with unpaid/partially paid payments only; used by reminder cron. No email if no pending.';

GRANT EXECUTE ON FUNCTION public.get_student_reminder_recipients() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_student_reminder_recipients() TO authenticated;
