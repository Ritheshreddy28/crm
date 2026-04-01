import { createClient } from '@supabase/supabase-js';
import { sendReminderEmail, type DueItem } from './emailService.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type StudentReminderRow = {
  email: string | null;
  student_name: string | null;
  subjects: string | null;
  payment_status: string | null;
  balance_amount: number | null;
  currency: string | null;
};

export type ReminderJobResult = { sent: number; failed: number };

export type DelayedFuturePaymentRow = {
  email: string | null;
  recipient_name: string | null;
  payment_date: string;
  sender_name: string | null;
  category: string | null;
  custom_category: string | null;
  amount: number;
  currency: string | null;
};

export type ReminderJobType = 'students' | 'future' | 'all';

/**
 * Fetch students with pending balance and/or delayed future payments from Supabase RPCs.
 * type: 'students' = only student reminders, 'future' = only delayed future repayment reminders, 'all' = both.
 */
export async function runReminderJob(type: ReminderJobType = 'all'): Promise<ReminderJobResult> {
  const empty = { sent: 0, failed: 0 };
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[reminder] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return empty;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let sent = 0;
  let failed = 0;

  const runStudents = type === 'students' || type === 'all';
  const runFuture = type === 'future' || type === 'all';

  // --- Student reminders (unpaid / partially paid) ---
  if (runStudents) {
  const { data: rows, error } = await supabase.rpc('get_student_reminder_recipients');

  if (error) {
    console.error('[reminder] Student RPC error:', error.message);
  } else {
    const list = (rows ?? []) as StudentReminderRow[];
    const byEmail = new Map<string, DueItem[]>();
    const nameByEmail = new Map<string, string>();

    for (const r of list) {
      const email = r.email?.trim();
      if (!email) continue;
      if (!nameByEmail.has(email)) {
        nameByEmail.set(email, r.student_name?.trim() || email.split('@')[0]);
      }
      const status =
        r.payment_status === 'paid_partially'
          ? 'Partially paid'
          : r.payment_status === 'unpaid'
            ? 'Unpaid'
            : 'Pending';
      const dueItem: DueItem = {
        dueDate: status,
        senderName: r.subjects?.trim() || '—',
        amount: r.balance_amount ?? undefined,
        currency: r.currency ?? undefined,
      };
      const existing = byEmail.get(email) ?? [];
      existing.push(dueItem);
      byEmail.set(email, existing);
    }

    for (const [email, dueItems] of byEmail) {
      const name = nameByEmail.get(email) ?? email.split('@')[0];
      try {
        const ok = await sendReminderEmail(email, name, dueItems);
        if (ok) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }
  }
  }

  // --- Delayed future repayment reminders (overdue only, not yet marked done) ---
  if (runFuture) {
  const { data: delayedRows, error: delayedError } = await supabase.rpc('get_delayed_future_payment_reminders');

  if (delayedError) {
    console.error('[reminder] Delayed future repayment RPC error:', delayedError.message);
  } else {
    const delayedList = (delayedRows ?? []) as DelayedFuturePaymentRow[];
    if (delayedList.length > 0) {
      console.log('[reminder] Delayed future repayments: ' + delayedList.length + ' overdue row(s)');
    }
    const futureByEmail = new Map<string, DueItem[]>();
    const futureNameByEmail = new Map<string, string>();

    for (const r of delayedList) {
      const email = r.email?.trim();
      if (!email) continue;
      if (!futureNameByEmail.has(email)) {
        futureNameByEmail.set(email, r.recipient_name?.trim() || r.sender_name?.trim() || email.split('@')[0]);
      }
      // When category is "Other", show the value from the "other" box; otherwise show category
      const displayCategory =
        r.category === 'Other'
          ? (r.custom_category?.trim() || 'Other')
          : (r.category?.trim() || r.custom_category?.trim() || 'Other');
      const dueItem: DueItem = {
        dueDate: 'Overdue',
        senderName: displayCategory,
        amount: r.amount,
        currency: r.currency ?? undefined,
      };
      const existing = futureByEmail.get(email) ?? [];
      existing.push(dueItem);
      futureByEmail.set(email, existing);
    }

    const delayedOptions = {
      subject: '⏰ Delayed future repayment reminder',
      title: 'Delayed future repayment reminder',
      intro: 'You have the following delayed (overdue) future repayment(s) (pending until marked done):',
      footer: 'This reminder will be sent until the payment is marked as done.',
      secondColumnHeader: 'Category',
    };

    const futureSentBefore = sent;
    for (const [email, dueItems] of futureByEmail) {
      const name = futureNameByEmail.get(email) ?? email.split('@')[0];
      try {
        const ok = await sendReminderEmail(email, name, dueItems, delayedOptions);
        if (ok) sent++;
        else failed++;
      } catch (err) {
        console.error('[reminder] Future repayment email failed for', email, err);
        failed++;
      }
    }
    if (futureByEmail.size > 0) {
      console.log('[reminder] Delayed future repayment emails: ' + (sent - futureSentBefore) + ' sent, ' + futureByEmail.size + ' recipient(s)');
    }
  }
  }

  if (sent > 0 || failed > 0) {
    console.log('[reminder] Total: Sent ' + sent + ', Failed ' + failed);
  }
  return { sent, failed };
}
