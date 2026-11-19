// Pages on adamfoundation.com that show these pages in a frame (see
// assets/js/embed.js). Used by the pages (kawthar/assets/audience.js) and by the
// server (api/kawthar.js), so both accept the same addresses. If the list
// changes, change frame-ancestors in vercel.json to match.
export const EMBED_HOSTS = ['adamfoundation.com', 'www.adamfoundation.com'];

// The parent page's address (origin and path, no query) when `value` is a page
// on one of EMBED_HOSTS over HTTPS, otherwise null. `selfHost` is this site's
// own hostname: while it is localhost, a localhost parent is accepted too, for
// testing an embed locally.
export function parentPage(value, selfHost) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    return null;
  }
  const local = (host) => host === 'localhost' || host === '127.0.0.1';
  const allowed = (url.protocol === 'https:' && EMBED_HOSTS.includes(url.hostname))
    || (local(selfHost) && local(url.hostname) && /^https?:$/.test(url.protocol));
  return allowed ? `${url.origin}${url.pathname}` : null;
}
