-- Add optional sender/payer name and submitter email to payment_records so Admin "Search by Credited To" always shows who did the payment.
-- sender_name: who actually sent/paid (user-entered). submitted_by_email: who submitted the record (fallback for Sender when sender_name is null).

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS sender_name text;

ALTER TABLE payment_records
  ADD COLUMN IF NOT EXISTS submitted_by_email text;

COMMENT ON COLUMN payment_records.sender_name IS 'Optional: name of person/entity who sent or paid (payer).';
COMMENT ON COLUMN payment_records.submitted_by_email IS 'Email of user who submitted this record; used as Sender fallback when sender_name is null.';

-- Backfill submitted_by_email for existing rows from auth.users
UPDATE payment_records pr
SET submitted_by_email = u.email
FROM auth.users u
WHERE pr.user_id = u.id AND (pr.submitted_by_email IS NULL OR pr.submitted_by_email = '');
