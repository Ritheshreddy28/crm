/**
 * Currency symbols for display across the app.
 * Use getCurrencySymbol() and formatCurrency() so USD shows $ and INR shows ₹ etc.
 */
export const CURRENCY_SYMBOLS: { [key: string]: string } = {
  'USD': '$',
  'EUR': '€',
  'GBP': '£',
  'JPY': '¥',
  'AUD': 'A$',
  'CAD': 'C$',
  'CHF': 'CHF',
  'CNY': '¥',
  'INR': '₹',
  'Other': '$',
};

export function getCurrencySymbol(currency: string | null | undefined): string {
  if (currency == null || typeof currency !== 'string') return '$';
  const trimmed = currency.trim();
  if (!trimmed) return '$';
  const key = trimmed.toUpperCase();
  return CURRENCY_SYMBOLS[key] ?? CURRENCY_SYMBOLS['Other'] ?? '$';
}

/**
 * Format amount with the correct currency symbol (e.g. $100.00 for USD, ₹100.00 for INR).
 * Safe against null/undefined/NaN amount.
 * toLocaleString() requires 0 <= minimumFractionDigits <= maximumFractionDigits <= 20.
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string | null | undefined,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const safeAmount = typeof amount === 'number' && !Number.isNaN(amount) ? amount : 0;
  const symbol = getCurrencySymbol(currency);
  const maxFrac = options?.maximumFractionDigits ?? 2;
  const minFrac = options?.minimumFractionDigits ?? 2;
  const maxClamped = Math.min(20, Math.max(0, maxFrac));
  const minClamped = Math.min(20, Math.max(0, Math.min(minFrac, maxClamped)));
  const opts = {
    minimumFractionDigits: minClamped,
    maximumFractionDigits: maxClamped,
  };
  const formatted = safeAmount.toLocaleString('en-US', opts);
  return `${symbol}${formatted}`;
}
