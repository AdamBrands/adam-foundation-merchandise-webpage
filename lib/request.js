// Small helpers shared by the API functions.

const CODE_RE = /^[a-z0-9-]{1,40}$/;

// QR codes and sources are short lowercase slugs, e.g. "tote" or "eid-dinner-2026".
export function cleanCode(value) {
  const code = String(value ?? '').trim().toLowerCase();
  return CODE_RE.test(code) ? code : null;
}

export function deviceFrom(request) {
  const ua = request.headers.get('user-agent') || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

// Vercel cron requests carry "Authorization: Bearer <CRON_SECRET>".
export function isCron(request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get('authorization') === `Bearer ${secret}`;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// YYYY-MM-DD in UK time, offset by whole days from today.
export function londonDate(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86400000)
    .toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}
