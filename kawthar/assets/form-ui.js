// Browser helpers shared by the Kawthar page scripts (app.js for /kawthar and
// audience.js for the four audience pages).

// Common email domains, for "Did you mean …?" when someone mistypes one.
const DOMAINS = ['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'btinternet.com', 'aol.com', 'msn.com', 'sky.com', 'virginmedia.com'];

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// The corrected address when the domain is one or two letters away from a
// common one (gmial.com → gmail.com), otherwise null.
export function suggestEmail(value) {
  const text = String(value).trim();
  const at = text.lastIndexOf('@');
  const domain = at > 0 ? text.slice(at + 1).toLowerCase() : '';
  if (!domain.includes('.') || DOMAINS.includes(domain)) return null;
  let best = null;
  for (const d of DOMAINS) {
    const dist = levenshtein(domain, d);
    if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best ? `${text.slice(0, at + 1)}${best.d}` : null;
}

// QR codes and campaign links arrive as ?src=<code> (or the designs' ?source=).
export function sourceFrom(search, fallback) {
  const params = new URLSearchParams(search);
  const value = params.get('src') || params.get('source');
  return value && /^[a-z0-9-]{1,40}$/.test(value) ? value : fallback;
}
