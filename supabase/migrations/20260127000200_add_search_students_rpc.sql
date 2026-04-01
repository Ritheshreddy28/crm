/*
  # Add RPC for student search (safe for users)

  Problem:
    - Users cannot see student records uploaded by admins because RLS restricts SELECT to auth.uid() = user_id.
    - But the "Add Payments" workflow needs users to search students regardless of who uploaded them.

  Solution:
    - Create a SECURITY DEFINER RPC that returns only non-sensitive fields needed for search.
    - The function runs as the table owner and can read through RLS, but does not expose passwords.
*/

CREATE OR REPLACE FUNCTION public.search_students(search_query text)
RETURNS TABLE (
  id uuid,
  student_name text,
  email text,
  phone_number text,
  university text,
  subjects text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sr.id,
    sr.student_name,
    sr.email,
    sr.phone_number,
    sr.university,
    sr.subjects
  FROM public.student_records sr
  WHERE
    search_query IS NOT NULL
    AND length(trim(search_query)) >= 2
    AND (
      sr.student_name ILIKE '%' || search_query || '%'
      OR coalesce(sr.email, '') ILIKE '%' || search_query || '%'
    )
  ORDER BY sr.created_at DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.search_students(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_students(text) TO authenticated;

