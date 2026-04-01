-- Fix payment-screenshots storage SELECT policy so screenshot links load
-- - Admins can view all (check both app_metadata and user_metadata for role)
-- - Users can view their own screenshots (folder matches auth.uid())

DROP POLICY IF EXISTS "Admins can view all payment screenshots" ON storage.objects;

CREATE POLICY "View payment screenshots"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'payment-screenshots'
    AND (
      -- Admins can view all
      (auth.jwt()->'app_metadata'->>'role') = 'admin'
      OR (auth.jwt()->'user_metadata'->>'role') = 'admin'
      -- Users can view their own folder
      OR (storage.foldername(name))[1] = auth.uid()::text
    )
  );
