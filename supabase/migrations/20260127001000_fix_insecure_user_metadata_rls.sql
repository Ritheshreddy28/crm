/*
  # Fix insecure RLS policies using user_metadata

  Problem:
    - Several RLS policies check `auth.jwt()->'user_metadata'->>'role' = 'admin'`
    - `user_metadata` can be edited by end users, making this insecure
  
  Solution:
    - Change all admin checks to use `app_metadata` instead
    - `app_metadata` can only be set server-side (via service role or admin API)
  
  IMPORTANT: After running this migration, you must also update your admin users
  to have their role in `app_metadata` instead of `user_metadata`.
  
  To set app_metadata for an admin user, run this in Supabase SQL Editor:
  
  UPDATE auth.users 
  SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
  WHERE email = 'your-admin@email.com';
  
  Or use the Supabase Dashboard: Authentication > Users > Select user > Edit > App Metadata
*/

-- ============================================
-- Fix excel_uploads table policies
-- ============================================

-- Drop insecure policies
DROP POLICY IF EXISTS "Admins can view all excel uploads" ON excel_uploads;
DROP POLICY IF EXISTS "Admins can delete excel uploads" ON excel_uploads;
DROP POLICY IF EXISTS "Admins can update excel uploads" ON excel_uploads;
DROP POLICY IF EXISTS "Admins can insert excel uploads" ON excel_uploads;

-- Recreate with secure app_metadata check
CREATE POLICY "Admins can view all excel uploads"
  ON excel_uploads FOR SELECT
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');

CREATE POLICY "Admins can delete excel uploads"
  ON excel_uploads FOR DELETE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');

CREATE POLICY "Admins can update excel uploads"
  ON excel_uploads FOR UPDATE
  TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');

CREATE POLICY "Admins can insert excel uploads"
  ON excel_uploads FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');

-- ============================================
-- Fix storage.objects policies for excel-uploads bucket
-- ============================================

-- Drop the insecure policy
DROP POLICY IF EXISTS "Admins can view all excel files" ON storage.objects;

-- Recreate with secure app_metadata check
CREATE POLICY "Admins can view all excel files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'excel-uploads' AND
    (auth.jwt()->'app_metadata'->>'role')::text = 'admin'
  );

-- ============================================
-- Fix storage.objects policies for payment-screenshots bucket
-- ============================================

-- Drop insecure policy if exists
DROP POLICY IF EXISTS "Admins can view all payment screenshots" ON storage.objects;

-- Recreate with secure app_metadata check (if this policy exists)
DO $$
BEGIN
  -- Check if the payment-screenshots bucket exists before creating policy
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-screenshots') THEN
    CREATE POLICY "Admins can view all payment screenshots"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'payment-screenshots' AND
        (auth.jwt()->'app_metadata'->>'role')::text = 'admin'
      );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL; -- Policy already exists, ignore
END $$;

-- ============================================
-- Fix payment_records table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all payment records" ON payment_records;
DROP POLICY IF EXISTS "Admins can delete payment records" ON payment_records;
DROP POLICY IF EXISTS "Admins can update payment records" ON payment_records;
DROP POLICY IF EXISTS "Admins can insert payment records" ON payment_records;

-- Check if table exists before creating policy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_records' AND table_schema = 'public') THEN
    -- SELECT policy
    CREATE POLICY "Admins can view all payment records"
      ON payment_records FOR SELECT
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- DELETE policy
    CREATE POLICY "Admins can delete payment records"
      ON payment_records FOR DELETE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- UPDATE policy
    CREATE POLICY "Admins can update payment records"
      ON payment_records FOR UPDATE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin')
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- INSERT policy  
    CREATE POLICY "Admins can insert payment records"
      ON payment_records FOR INSERT
      TO authenticated
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- Fix future_payments table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all future payments" ON future_payments;
DROP POLICY IF EXISTS "Admins can delete future payments" ON future_payments;
DROP POLICY IF EXISTS "Admins can update future payments" ON future_payments;
DROP POLICY IF EXISTS "Admins can insert future payments" ON future_payments;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'future_payments' AND table_schema = 'public') THEN
    -- SELECT policy
    CREATE POLICY "Admins can view all future payments"
      ON future_payments FOR SELECT
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- DELETE policy
    CREATE POLICY "Admins can delete future payments"
      ON future_payments FOR DELETE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- UPDATE policy
    CREATE POLICY "Admins can update future payments"
      ON future_payments FOR UPDATE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin')
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- INSERT policy
    CREATE POLICY "Admins can insert future payments"
      ON future_payments FOR INSERT
      TO authenticated
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- Fix student_records table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all student records" ON student_records;
DROP POLICY IF EXISTS "Admins can delete student records" ON student_records;
DROP POLICY IF EXISTS "Admins can update student records" ON student_records;
DROP POLICY IF EXISTS "Admins can insert student records" ON student_records;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_records' AND table_schema = 'public') THEN
    -- SELECT policy
    CREATE POLICY "Admins can view all student records"
      ON student_records FOR SELECT
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- DELETE policy
    CREATE POLICY "Admins can delete student records"
      ON student_records FOR DELETE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- UPDATE policy
    CREATE POLICY "Admins can update student records"
      ON student_records FOR UPDATE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin')
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    -- INSERT policy
    CREATE POLICY "Admins can insert student records"
      ON student_records FOR INSERT
      TO authenticated
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- Fix student_payments table policies
-- ============================================

DROP POLICY IF EXISTS "Admins can view all student payments" ON student_payments;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_payments' AND table_schema = 'public') THEN
    CREATE POLICY "Admins can view all student payments"
      ON student_payments FOR SELECT
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- Add admin INSERT/UPDATE/DELETE for student_payments
-- ============================================

DROP POLICY IF EXISTS "Admins can insert student payments" ON student_payments;
DROP POLICY IF EXISTS "Admins can update student payments" ON student_payments;
DROP POLICY IF EXISTS "Admins can delete student payments" ON student_payments;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_payments' AND table_schema = 'public') THEN
    CREATE POLICY "Admins can insert student payments"
      ON student_payments FOR INSERT
      TO authenticated
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    CREATE POLICY "Admins can update student payments"
      ON student_payments FOR UPDATE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin')
      WITH CHECK ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
    
    CREATE POLICY "Admins can delete student payments"
      ON student_payments FOR DELETE
      TO authenticated
      USING ((auth.jwt()->'app_metadata'->>'role')::text = 'admin');
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $$;
