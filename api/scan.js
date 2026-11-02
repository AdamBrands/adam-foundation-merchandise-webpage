import { sql } from './_lib/db.js';
import { cleanCode, deviceFrom } from './_lib/request.js';

// Printed QR codes point at /q/<code>, rewritten here by vercel.json.
// Records the scan, then sends the visitor to the page with the source attached.
// A database problem never blocks the redirect.
export async function GET(request) {
  const url = new URL(request.url);
  const code = cleanCode(url.searchParams.get('code') ?? url.pathname.split('/q/')[1]);
  if (!code) return redirect('/');

  try {
    await sql`insert into scans (code, device) values (${code}, ${deviceFrom(request)})`;
  } catch (err) {
    console.error('scan insert failed', err);
  }
  return redirect(`/?src=${code}`);
}

function redirect(location) {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}
