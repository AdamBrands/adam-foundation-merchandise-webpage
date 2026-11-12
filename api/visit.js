import { sql } from './_lib/db.js';
import { cleanCode, deviceFrom, isBot } from './_lib/request.js';

const PAGES = new Set(['donate', 'masjids', 'bottle', 'corporate']);
const MAX_BODY = 512;

// Counts a visit to a Kawthar page. kawthar/assets/audience.js sends
// { page, source } once per page load, where source is the ?src= code or
// kawthar-<page>, the same value a submission from that visit is stored with.
// Stores the page, source, device type and time: no IP addresses or cookies.
// Bots aren't counted. Always answers 204, so a database problem never shows
// on the page.
export async function POST(request) {
  let payload = null;
  try {
    const raw = await request.text();
    if (raw.length <= MAX_BODY) payload = JSON.parse(raw);
  } catch {
    // Not JSON: ignored.
  }

  const page = typeof payload?.page === 'string' && PAGES.has(payload.page) ? payload.page : null;
  const source = cleanCode(payload?.source);
  if (page && source && !isBot(request)) {
    try {
      await sql`insert into page_visits (page, source, device) values (${page}, ${source}, ${deviceFrom(request)})`;
    } catch (err) {
      console.error('visit insert failed', err);
    }
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
