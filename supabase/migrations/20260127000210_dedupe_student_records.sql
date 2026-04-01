/*
  # Deduplicate student_records by (user_id, email)

  Problem:
    - Historical imports may have created multiple rows with the same (user_id, email),
      each containing different or identical subject lists.

  Goal:
    - For each (user_id, email) group:
        * Keep a single "primary" row (the oldest by created_at / id)
        * Merge all subject values from that group into the primary row
          (concatenated unique list of subjects, with whitespace trimmed)
        * Delete the other duplicate rows in that group
*/

DO $$
DECLARE
  r RECORD;
BEGIN
  -- For each (user_id, email) that has more than one row
  FOR r IN
    SELECT
      user_id,
      email,
      MIN(id) AS keep_id
    FROM public.student_records
    WHERE email IS NOT NULL
    GROUP BY user_id, email
    HAVING COUNT(*) > 1
  LOOP
    -- Compute merged set of subjects for all rows in this group
    WITH all_subj AS (
      SELECT DISTINCT trim(both ' ' FROM unnest(string_to_array(COALESCE(sr.subjects, ''), ','))) AS subj
      FROM public.student_records sr
      WHERE sr.user_id = r.user_id
        AND sr.email IS NOT NULL
        AND lower(sr.email) = lower(r.email)
        AND sr.subjects IS NOT NULL
    )
    UPDATE public.student_records s
      SET subjects = (
        SELECT string_agg(sv.subj, ', ' ORDER BY sv.subj)
        FROM all_subj sv
      )
    WHERE s.id = r.keep_id;

    -- Delete all other rows for this (user_id, email) except the primary one
    DELETE FROM public.student_records s
    WHERE s.user_id = r.user_id
      AND s.email IS NOT NULL
      AND lower(s.email) = lower(r.email)
      AND s.id <> r.keep_id;
  END LOOP;
END $$;

