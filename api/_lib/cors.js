import { EMBED_HOSTS } from '../../kawthar/assets/parent-page.js';

// Which websites may call the donations API (api/donations.js) from the
// browser, and send donors back to their own pages after Stripe Checkout.
//
// - https://adamfoundation.com and https://www.adamfoundation.com (EMBED_HOSTS
//   in kawthar/assets/parent-page.js, the same hosts allowed to embed connect)
// - any origins in DONATION_API_ORIGINS, comma-separated, e.g. the website
//   developer's staging site: "https://staging.adamfoundation.com". HTTPS only,
//   except a localhost origin (e.g. "http://localhost:8080"), which lets the
//   developer test a local WordPress against a Preview deployment. Set those in
//   Vercel's Preview environment only.
// - any localhost origin, but only while connect itself runs on localhost.

const isLocal = (host) => host === 'localhost' || host === '127.0.0.1';

function extraOrigins() {
  return String(process.env.DONATION_API_ORIGINS ?? '')
    .split(',')
    .map((value) => {
      try {
        const url = new URL(value.trim());
        return url.protocol === 'https:' || (url.protocol === 'http:' && isLocal(url.hostname)) ? url.origin : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// The origin, normalised, when it may call the API; otherwise null.
export function allowedOrigin(value, selfHost) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    return null;
  }
  if (isLocal(selfHost) && isLocal(url.hostname) && /^https?:$/.test(url.protocol)) return url.origin;
  const allowed = [...EMBED_HOSTS.map((host) => `https://${host}`), ...extraOrigins()];
  return allowed.includes(url.origin) ? url.origin : null;
}

// The page's address (origin and path, no query or hash) when it is on an
// allowed origin, so Stripe can send the donor back to it; otherwise null.
export function allowedReturnPage(value, selfHost) {
  let url;
  try {
    url = new URL(String(value ?? ''));
  } catch {
    return null;
  }
  return allowedOrigin(url.origin, selfHost) ? `${url.origin}${url.pathname}` : null;
}

// Response headers for a request from `origin` (already checked with
// allowedOrigin, or null for a request that sent no Origin header).
export function corsHeaders(origin) {
  return {
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    ...(origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    } : {}),
  };
}
