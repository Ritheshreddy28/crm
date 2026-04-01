# Payment Reminder Server

Node.js backend that sends Gmail reminder emails for due/upcoming payments. Runs a daily cron at 9:00 AM local time.

## Setup

1. **Install dependencies**
   ```bash
   cd server && npm install
   ```

2. **Environment**
   - Copy `server/.env.example` to `server/.env`
   - Set `GMAIL_USER` (your Gmail address) and `GMAIL_APP_PASS` (Google App Password)
   - Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from Supabase project settings)
   - Set `SUPABASE_JWT_SECRET` (Project Settings → API → JWT Secret) so the "Send reminder emails" button can verify admin

3. **Database**
   - Run migrations so `get_reminder_recipients` RPC exists: `supabase db push` from project root (or run `supabase/migrations/20260127100000_rpc_get_reminder_recipients.sql` in SQL Editor)

## Run

- **Development (with watch):** `npm run dev`
- **Production:** `npm run build` then `npm start`

The process listens on port 3001 (or `PORT`) and runs the job every day at 9:00 AM. The admin dashboard has a **Send reminder emails** button (Overview tab) that POSTs to `/api/send-reminders` with your session token; the server verifies the JWT and that the user is admin before running the job.

## Gmail App Password

Use a [Google App Password](https://support.google.com/accounts/answer/185833) for `GMAIL_APP_PASS`, not your normal Gmail password. Enable 2-Step Verification first.
