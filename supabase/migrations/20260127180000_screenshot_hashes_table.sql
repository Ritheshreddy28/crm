-- Dedicated table for screenshot hashes so we can reject duplicates across all flows
-- (insert, merge, payment_records, student_payments). Previously merge flow never stored hashes.

CREATE TABLE IF NOT EXISTS public.screenshot_hashes (
  hash text PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.screenshot_hashes IS 'Stores SHA-256 hash of every uploaded payment screenshot for duplicate detection across all flows.';
 
ALTER TABLE public.screenshot_hashes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can select screenshot_hashes"
  ON public.screenshot_hashes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert screenshot_hashes"
  ON public.screenshot_hashes FOR INSERT TO authenticated WITH CHECK (true);

-- Migrate existing hashes from payment_records and student_payments
INSERT INTO public.screenshot_hashes (hash)
SELECT DISTINCT screenshot_hash FROM public.payment_records
WHERE screenshot_hash IS NOT NULL AND trim(screenshot_hash) <> ''
ON CONFLICT (hash) DO NOTHING;

INSERT INTO public.screenshot_hashes (hash)
SELECT DISTINCT screenshot_hash FROM public.student_payments
WHERE screenshot_hash IS NOT NULL AND trim(screenshot_hash) <> ''
ON CONFLICT (hash) DO NOTHING;

-- Update RPC to check screenshot_hashes (primary) and legacy columns
DROP FUNCTION IF EXISTS public.screenshot_hash_exists(text);

CREATE OR REPLACE FUNCTION public.screenshot_hash_exists(p_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM screenshot_hashes WHERE hash = p_hash AND p_hash IS NOT NULL AND trim(p_hash) <> '')
    OR EXISTS (SELECT 1 FROM payment_records WHERE screenshot_hash = p_hash AND p_hash IS NOT NULL)
    OR EXISTS (SELECT 1 FROM student_payments WHERE screenshot_hash = p_hash AND p_hash IS NOT NULL);
$$;

-- RPC to record a screenshot hash (call after every upload)
DROP FUNCTION IF EXISTS public.record_screenshot_hash(text);

CREATE OR REPLACE FUNCTION public.record_screenshot_hash(p_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_hash IS NULL OR trim(p_hash) = '' THEN
    RETURN;
  END IF;
  INSERT INTO public.screenshot_hashes (hash) VALUES (trim(p_hash))
  ON CONFLICT (hash) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_screenshot_hash(text) TO authenticated;
