import { sql } from './_lib/db.js';
import { cleanCode, deviceFrom, isBot } from './_lib/request.js';

// Printed QR codes point at /q/<code>, rewritten here by vercel.json.
// Records the scan, then sends the visitor to the page with the source attached.
// Link previews are redirected but not counted. A database problem never blocks
// the redirect.
export async function GET(request) {
  const url = new URL(request.url);
  const code = cleanCode(url.searchParams.get('code') ?? url.pathname.split('/q/')[1]);
  if (!code) return redirect('/');

  if (!isBot(request)) {
    try {
      await sql`insert into scans (code, device) values (${code}, ${deviceFrom(request)})`;
    } catch (err) {
      console.error('scan insert failed', err);
    }
  }
  return redirect(`/?src=${code}`);
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
