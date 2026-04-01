-- RPC for reminder cron: returns users with due/upcoming future payments (pending only).
-- Used by backend with service role to send Gmail reminders.
-- days_ahead: include payments due from (today - 1) to (today + days_ahead).

CREATE OR REPLACE FUNCTION public.get_reminder_recipients(days_ahead int DEFAULT 7)
RETURNS TABLE (
  email text,
  user_name text,
  payment_date date,
  sender_name text,
  amount numeric,
  currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.email::text,
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      split_part(u.email, '@', 1)
    )::text,
    fp.payment_date,
    fp.sender_name,
    fp.amount,
    coalesce(fp.currency, 'INR')::text
  FROM public.future_payments fp
  JOIN auth.users u ON u.id = fp.user_id
  WHERE coalesce(fp.status, 'pending') = 'pending'
    AND fp.payment_date <= (CURRENT_DATE + days_ahead)
    AND fp.payment_date >= (CURRENT_DATE - 1)
  ORDER BY fp.payment_date, u.email;
$$;

COMMENT ON FUNCTION public.get_reminder_recipients(int) IS 'Returns rows for users with due/upcoming future payments; used by reminder cron.';

GRANT EXECUTE ON FUNCTION public.get_reminder_recipients(int) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_reminder_recipients(int) TO authenticated;
