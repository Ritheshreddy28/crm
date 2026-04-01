import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASS;

const transporter =
  user && pass
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      })
    : null;

export type DueItem = {
  dueDate: string;
  senderName?: string;
  amount?: number;
  currency?: string;
};

export type ReminderEmailOptions = {
  subject?: string;
  title?: string;
  intro?: string;
  footer?: string;
  /** Second table column header: "Subjects / Course" (default for students) or "Category" (for future repayments). */
  secondColumnHeader?: string;
};

/**
 * Send a payment reminder email. Uses GMAIL_USER and GMAIL_APP_PASS from env.
 * Returns true on success, false if transporter not configured or send failed.
 */
export async function sendReminderEmail(
  to: string,
  name: string,
  dueItems: DueItem[],
  options?: ReminderEmailOptions
): Promise<boolean> {
  if (!transporter || !to?.trim()) return false;

  const subject = options?.subject ?? '⏰ Payment Reminder';
  const title = options?.title ?? 'Payment Reminder';
  const intro = options?.intro ?? 'You have the following pending balance(s):';
  const footer = options?.footer ?? 'This is an automated reminder. Please clear your pending balance at your earliest.';
  const secondColumnHeader = options?.secondColumnHeader ?? 'Subjects / Course';

  const rows = dueItems
    .map(
      (d) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(d.dueDate)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${escapeHtml(d.senderName ?? '—')}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${formatAmount(d.amount, d.currency)}</td></tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;background:#f9fafb">
  <div style="background:#fff;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <h1 style="margin:0 0 16px;font-size:20px;color:#111">${escapeHtml(title)}</h1>
    <p style="margin:0 0 20px;color:#555;line-height:1.5">Hi ${escapeHtml(name)},</p>
    <p style="margin:0 0 16px;color:#555;line-height:1.5">${escapeHtml(intro)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">Status</th><th style="padding:8px 12px;text-align:left">${escapeHtml(secondColumnHeader)}</th><th style="padding:8px 12px;text-align:left">Amount to be paid</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#888">${escapeHtml(footer)}</p>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: user,
      to: to.trim(),
      subject,
      html,
    });
    return true;
  } catch {
    return false;
  }
}

function escapeHtml(s: string | undefined): string {
  if (s == null) return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatAmount(amount: number | undefined, currency?: string): string {
  if (amount == null) return '—';
  const sym = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency ?? '';
  return `${sym}${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
