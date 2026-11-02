import { sql } from '../../lib/db.js';
import { isCron } from '../../lib/request.js';

// Vercel cron, daily (see vercel.json). Free Supabase projects pause after a
// week with no activity, which would break the book form; one query a day prevents that.
export async function GET(request) {
  if (!isCron(request)) return new Response('Unauthorised', { status: 401 });
  await sql`select 1`;
  return Response.json({ ok: true });
}
