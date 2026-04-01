import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { runReminderJob } from './reminderCron.js';
import { sendReminderEmail, type DueItem } from './emailService.js';

const app = express();
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.use(cors({ origin: true }));
app.use(express.json());

function getRoleFromUser(user: { app_metadata?: unknown; user_metadata?: unknown; raw_app_meta_data?: unknown; raw_user_meta_data?: unknown }): string | undefined {
  const am = user.app_metadata as { role?: string } | undefined;
  const um = user.user_metadata as { role?: string } | undefined;
  const rawAm = user.raw_app_meta_data as { role?: string } | undefined;
  const rawUm = user.raw_user_meta_data as { role?: string } | undefined;
  return am?.role ?? um?.role ?? rawAm?.role ?? rawUm?.role;
}

/**
 * Verify the JWT using Supabase auth.getUser(token). Works with both
 * Legacy JWT Secret (HS256) and JWT Signing Keys (RS256).
 */
async function isAdmin(token: string): Promise<boolean> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[reminder] SUPABASE_URL or SUPABASE_ANON_KEY not set');
    return false;
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error('[reminder] getUser failed:', error.message);
    return false;
  }
  if (!user) return false;
  const role = getRoleFromUser(user);
  if (role === 'admin') return true;
  console.error('[reminder] User not admin; role:', role ?? 'none');
  return false;
}

app.post('/api/send-reminders', async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const admin = await isAdmin(token);
  if (!admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const type = req.body?.type === 'students' || req.body?.type === 'future' ? req.body.type : 'all';
  try {
    const result = await runReminderJob(type);
    res.json({ ok: true, sent: result.sent, failed: result.failed, type });
  } catch (err) {
    console.error('[reminder] API error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Reminder job failed' });
  }
});

/**
 * Send reminder email to a single student by student_id (admin only).
 * Body: { student_id: string }
 */
app.post('/api/send-reminder-to-student', async (req, res) => {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const admin = await isAdmin(token);
  if (!admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const studentId = req.body?.student_id;
  if (!studentId || typeof studentId !== 'string') {
    res.status(400).json({ error: 'student_id required' });
    return;
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ error: 'Server not configured' });
    return;
  }
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: student, error: studentError } = await supabase
      .from('student_records')
      .select('id, email, student_name, subjects')
      .eq('id', studentId)
      .single();
    if (studentError || !student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    const email = student.email?.trim();
    if (!email) {
      res.status(400).json({ error: 'Student has no email' });
      return;
    }
    const { data: payments } = await supabase
      .from('student_payments')
      .select('subjects, payment_status, balance_amount, currency')
      .eq('student_id', studentId)
      .gt('balance_amount', 0)
      .in('payment_status', ['unpaid', 'paid_partially']);
    const dueItems: DueItem[] = (payments ?? []).map((p: { subjects?: string; payment_status?: string; balance_amount: number; currency?: string }) => {
      const status =
        p.payment_status === 'paid_partially' ? 'Partially paid' : p.payment_status === 'unpaid' ? 'Unpaid' : 'Pending';
      return {
        dueDate: status,
        senderName: p.subjects?.trim() || '—',
        amount: p.balance_amount,
        currency: p.currency,
      };
    });
    if (dueItems.length === 0) {
      res.status(400).json({ error: 'Student has no unpaid or partially paid payments; no reminder sent.' });
      return;
    }
    const name = student.student_name?.trim() || email.split('@')[0];
    const ok = await sendReminderEmail(email, name, dueItems);
    if (ok) res.json({ ok: true });
    else res.status(500).json({ error: 'Failed to send email' });
  } catch (err) {
    console.error('[reminder] send-to-student error:', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

export function startReminderServer(port: number): void {
  app.listen(port, () => {
    console.log(`[reminder] API listening on port ${port}`);
  });
}
