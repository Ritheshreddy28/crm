-- RPC for reminder cron: returns only future payments whose DEADLINE HAS ALREADY PASSED (overdue).
-- Email is sent ONLY when expected date is STRICTLY BEFORE today (payment_date < today in UTC).
-- If expected date is Feb 15, 2026, no email is sent until the day after Feb 15 (UTC).
-- Sends to future_payments.email if set, otherwise to the user who created the record (auth.users.email).

DROP FUNCTION IF EXISTS public.get_delayed_future_payment_reminders();

CREATE OR REPLACE FUNCTION public.get_delayed_future_payment_reminders()
RETURNS TABLE (
  email text,
  recipient_name text,
  payment_date date,
  sender_name text,
  category text,
  custom_category text,
  amount numeric,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    coalesce(nullif(trim(fp.email), ''), u.email::text)::text,
    coalesce(nullif(trim(fp.sender_name), ''), split_part(u.email, '@', 1))::text,
    fp.payment_date,
    fp.sender_name::text,
    coalesce(nullif(trim(fp.category), ''), 'Other')::text,
    coalesce(trim(fp.custom_category), '')::text,
    fp.amount,
    coalesce(fp.currency, 'USD')::text
  FROM public.future_payments fp
  JOIN auth.users u ON u.id = fp.user_id
  WHERE coalesce(fp.status, 'pending') <> 'done'
    AND fp.payment_date < ((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date)
    AND coalesce(nullif(trim(fp.email), ''), u.email) IS NOT NULL
  ORDER BY coalesce(nullif(trim(fp.email), ''), u.email), fp.payment_date;
$$;

COMMENT ON FUNCTION public.get_delayed_future_payment_reminders() IS 'Returns only delayed (overdue) pending future payments; used to send reminder emails until marked done.';

GRANT EXECUTE ON FUNCTION public.get_delayed_future_payment_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_delayed_future_payment_reminders() TO authenticated;
