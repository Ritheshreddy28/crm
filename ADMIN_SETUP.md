# Admin Account Setup

The admin system is already fully set up and ready to use! Follow these simple steps to create your admin account.

## Step-by-Step Setup Process

### Step 1: Create Your Account
1. Go to your application at `/login`
2. Click "Don't have an account? Sign up"
3. Create an account with your email and password
4. **Important:** Remember your email and password!

### Step 2: Grant Admin Access in Supabase

After creating your account, grant yourself admin privileges:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Copy the SQL command below and **replace** `'your-email@example.com'` with the email you used to sign up:

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@example.com';
```

5. Click "Run" to execute the command
6. You should see "Success. No rows returned" - this is correct!

### Step 3: Log Out and Log Back In

**This step is critical:**
1. If you're currently logged in, click "Sign Out" in your application
2. This ensures your session gets the updated admin role

### Step 4: Access Admin Dashboard
1. Go to `/admin/login` on your application
2. Sign in with your credentials (the same email and password from Step 1)
3. You now have full admin access!

**Troubleshooting:** If you still can't access the admin dashboard:
- Make sure you ran the SQL with the correct email address
- Verify you logged out completely before trying to log in again
- Check that you're using `/admin/login` (not `/login`)
- The error message will tell you if your account lacks admin privileges

## Admin Features

Your admin dashboard includes:

- 📊 View all payment records from all users
- 💰 See complete payment details (amount, currency, method, type)
- 📅 Payment dates and submission timestamps
- 👤 Recipient and bank holder information
- 🔢 UTR/transaction numbers
- 📝 Payment notes and requirements
- 🖼️ View payment screenshots (click "View" button)
- 🔄 Real-time updates

## Routes

- **User Login:** `/login`
- **Admin Login:** `/admin/login`
- **User Dashboard:** `/dashboard` (users only)
- **Admin Dashboard:** `/admin/dashboard` (admins only)

## Security Features

- Row Level Security (RLS) enforced on all tables
- Admins can view ALL payment records
- Regular users can only submit payments (no viewing)
- Storage bucket access controlled by RLS policies
- Protected routes with role-based authentication
