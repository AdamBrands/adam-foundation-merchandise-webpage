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

// Link-preview fetchers and crawlers: pasting a QR's link into a chat makes
// these request it, and that is not somebody scanning the code. Same list and
// Purpose check as the RMS portal's dynamic QR counter, so the two totals agree.
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|WhatsApp|Slackbot|TelegramBot|Discordbot|LinkedInBot|Twitterbot|SkypeUriPreview|Embedly|preview|curl|wget|python-requests|HeadlessChrome/i;

export function isBot(request) {
  const purpose = (request.headers.get('purpose') || '').toLowerCase();
  return BOT_RE.test(request.headers.get('user-agent') || '') || purpose === 'prefetch' || purpose === 'preview';
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
