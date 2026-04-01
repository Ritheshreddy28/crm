-- Admin Setup SQL
-- ===========================================
-- IMPORTANT: Replace 'your-email@example.com' with the email you used to sign up
-- Run this in Supabase SQL Editor (SQL Editor tab in left sidebar)
-- ===========================================

-- Step 1: Update user role to admin
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';

-- Step 2: Verify the update (optional but recommended)
-- This query will show your account with the admin role
SELECT
  email,
  raw_user_meta_data->>'role' as role,
  created_at
FROM auth.users
WHERE email = 'your-email@example.com';

-- Expected result: You should see your email with role = 'admin'
-- If role is NULL or 'user', the UPDATE didn't work - check the email address

-- After running this:
-- 1. Log out of your application if you're logged in
-- 2. Go to /admin/login
-- 3. Log in with your credentials
-- 4. You should now have admin access!
