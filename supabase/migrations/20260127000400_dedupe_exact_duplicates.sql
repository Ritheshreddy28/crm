/*
  # Deduplicate exact duplicate student records

  Problem:
    - Some records may be exact duplicates (same email, name, phone, university, subjects)
    - These should be merged into a single record

  Goal:
    - For each (user_id, email) group with exact duplicates:
        * Keep the oldest record (by created_at / id)
        * Delete all other exact duplicates
    - Also handle records without email by checking name+phone+university+subjects
*/

DO $$
DECLARE
  r RECORD;
  keep_id_val uuid;
  duplicate_count INTEGER;
BEGIN
  -- First, handle duplicates with email
  FOR r IN
    SELECT
      user_id,
      email,
      LOWER(TRIM(student_name)) AS normalized_name,
      TRIM(phone_number) AS normalized_phone,
      LOWER(TRIM(university)) AS normalized_university,
      TRIM(COALESCE(subjects, '')) AS normalized_subjects
    FROM public.student_records
    WHERE email IS NOT NULL
    GROUP BY user_id, email, LOWER(TRIM(student_name)), TRIM(phone_number), LOWER(TRIM(university)), TRIM(COALESCE(subjects, ''))
    HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the oldest record (by created_at, then by id)
    SELECT id INTO keep_id_val
    FROM public.student_records
    WHERE user_id = r.user_id
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(r.email)
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Count how many duplicates we're removing
    SELECT COUNT(*) INTO duplicate_count
    FROM public.student_records
    WHERE user_id = r.user_id
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(r.email)
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
      AND id <> keep_id_val;

    -- Delete exact duplicates (keep the oldest one)
    DELETE FROM public.student_records
    WHERE user_id = r.user_id
      AND email IS NOT NULL
      AND LOWER(email) = LOWER(r.email)
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
      AND id <> keep_id_val;

    RAISE NOTICE 'Removed % duplicate(s) for user_id=%, email=%', duplicate_count, r.user_id, r.email;
  END LOOP;

  -- Now handle duplicates without email (match by name+phone+university+subjects)
  FOR r IN
    SELECT
      user_id,
      LOWER(TRIM(student_name)) AS normalized_name,
      TRIM(phone_number) AS normalized_phone,
      LOWER(TRIM(university)) AS normalized_university,
      TRIM(COALESCE(subjects, '')) AS normalized_subjects
    FROM public.student_records
    WHERE email IS NULL OR email = ''
    GROUP BY user_id, LOWER(TRIM(student_name)), TRIM(phone_number), LOWER(TRIM(university)), TRIM(COALESCE(subjects, ''))
    HAVING COUNT(*) > 1
  LOOP
    -- Get the ID of the oldest record (by created_at, then by id)
    SELECT id INTO keep_id_val
    FROM public.student_records
    WHERE user_id = r.user_id
      AND (email IS NULL OR email = '')
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    -- Count how many duplicates we're removing
    SELECT COUNT(*) INTO duplicate_count
    FROM public.student_records
    WHERE user_id = r.user_id
      AND (email IS NULL OR email = '')
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
      AND id <> keep_id_val;

    -- Delete exact duplicates (keep the oldest one)
    DELETE FROM public.student_records
    WHERE user_id = r.user_id
      AND (email IS NULL OR email = '')
      AND LOWER(TRIM(student_name)) = r.normalized_name
      AND TRIM(phone_number) = r.normalized_phone
      AND LOWER(TRIM(university)) = r.normalized_university
      AND TRIM(COALESCE(subjects, '')) = r.normalized_subjects
      AND id <> keep_id_val;

    RAISE NOTICE 'Removed % duplicate(s) for user_id=%, name=% (no email)', duplicate_count, r.user_id, r.normalized_name;
  END LOOP;

  RAISE NOTICE 'Deduplication complete';
END $$;
