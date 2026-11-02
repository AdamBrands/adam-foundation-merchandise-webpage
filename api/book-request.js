import { sql } from './_lib/db.js';
import { bookEmail, sendEmail } from './_lib/email.js';
import { CONSENT_TEXT, CONSENT_VERSION } from './_lib/consent.js';
import { cleanCode, deviceFrom, escapeHtml } from './_lib/request.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Receives the Adhkar book form. Accepts JSON from assets/js/book.js, or a
// normal form post when JavaScript is off. Every request is stored; the book
// is emailed whatever the marketing choice. A repeat request for the same
// address within 10 minutes is stored as "duplicate" and not re-sent.
export async function POST(request) {
  const wantsJson = (request.headers.get('content-type') || '').includes('application/json');
  const reply = (status, message, extra = {}) => (wantsJson
    ? Response.json({ ok: status < 400, message, ...extra }, { status })
    : htmlReply(status, message, extra.emailed === false ? 'Thank you' : undefined));

  let data;
  try {
    data = wantsJson ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return reply(400, 'Something went wrong. Please try again.');
  }

  const email = String(data.email ?? '').trim();
  const optIn = data.marketing === true || data.marketing === 'yes' || data.marketing === 'on';
  const source = cleanCode(data.source) || 'direct';

  // Honeypot: people never see this field, bots fill it in.
  if (data.website) return reply(200, successMessage(email));

  if (email.length > 254 || !EMAIL_RE.test(email)) {
    return reply(422, 'Please enter a valid email address.');
  }

  let id;
  let duplicate;
  try {
    [{ duplicate }] = await sql`
      select exists (
        select 1 from book_requests
        where lower(email) = lower(${email})
          and email_status = 'sent'
          and created_at > now() - interval '10 minutes'
      ) as duplicate`;
    [{ id }] = await sql`
      insert into book_requests
        (email, marketing_opt_in, consent_text, consent_version, source, device, is_test, email_status)
      values
        (${email}, ${optIn}, ${CONSENT_TEXT}, ${CONSENT_VERSION}, ${source}, ${deviceFrom(request)},
         ${source === 'test'}, ${duplicate ? 'duplicate' : 'pending'})
      returning id`;
  } catch (err) {
    console.error('book request insert failed', err);
    return reply(503, 'We couldn’t take your request just now. Please try again in a moment.');
  }

  if (duplicate) return reply(200, successMessage(email));

  try {
    const emailId = await sendEmail(await bookEmail({ email, optIn }));
    await sql`update book_requests set email_status = 'sent', email_id = ${emailId} where id = ${id}`;
  } catch (err) {
    console.error('book email failed', err);
    await sql`
      update book_requests set email_status = 'failed', email_error = ${String(err.message).slice(0, 500)}
      where id = ${id}`.catch((e) => console.error('status update failed', e));
    return reply(200, 'We’ve saved your request, but the email didn’t send straight away. We’ll send your book to you shortly.', { emailed: false });
  }

  return reply(200, successMessage(email), { emailed: true });
}

function successMessage(email) {
  return `We’ve sent the Adhkar book to ${email}. It should arrive in a few minutes. If you can’t see it, please check your junk folder.`;
}

// Shown only when the form is posted without JavaScript.
function htmlReply(status, message, heading) {
  const title = heading || (status < 400 ? 'Check your inbox' : 'Please try again');
  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · Adam Foundation</title>
<style>body{margin:0;font-family:Arial,sans-serif;color:#061238;background:#fff}main{max-width:510px;margin:0 auto;padding:48px 26px}
h1{font-size:28px;margin:0 0 16px}p{font-size:15px;line-height:1.6;color:#233352}a{color:#0055b8}</style></head>
<body><main><h1>${title}</h1><p>${escapeHtml(message)}</p>
<p><a href="/">Back to Adam Foundation</a></p></main></body></html>`, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
