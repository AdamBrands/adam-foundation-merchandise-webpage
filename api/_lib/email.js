import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { escapeHtml } from './request.js';

// The book ships with the site. vercel.json bundles adhkar/ with the
// book-request function so it can be attached without downloading it.
const BOOK_FILE = 'adhkar/adhkar-book.pdf';

// Attachments grow by a third when sent, and many inboxes refuse emails over
// 20-25 MB, so larger books go out as the download link only.
const MAX_ATTACH_BYTES = 10 * 1024 * 1024;

// Sends through the Mandrill (Mailchimp Transactional) API. Returns the Mandrill
// message id(s). Attachments are { type, name, content } with base64 content.
// Open and click tracking are off: links stay as written and nobody is tracked
// without having opted in.
export async function sendEmail({ to, subject, html, text, attachments, tags }) {
  const key = process.env.MANDRILL_API_KEY;
  if (!key) throw new Error('MANDRILL_API_KEY is not set');
  if (!process.env.MAIL_FROM) throw new Error('MAIL_FROM is not set');
  const from = parseAddress(process.env.MAIL_FROM);
  if (!from) throw new Error(`MAIL_FROM is not a valid address: ${JSON.stringify(process.env.MAIL_FROM)}`);

  const res = await fetch('https://mandrillapp.com/api/1.0/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key,
      message: {
        from_email: from.email,
        from_name: from.name,
        to: (Array.isArray(to) ? to : [to]).map((email) => ({ email, type: 'to' })),
        headers: process.env.MAIL_REPLY_TO ? { 'Reply-To': process.env.MAIL_REPLY_TO } : undefined,
        subject,
        html,
        text,
        attachments,
        tags,
        track_opens: false,
        track_clicks: false,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(body)) {
    throw new Error(body?.message || `Mandrill responded ${res.status}`);
  }
  // Mandrill answers 200 even when it refuses a recipient, so check each result.
  const refused = body.find((r) => r.status === 'rejected' || r.status === 'invalid');
  if (refused) {
    throw new Error(`Mandrill ${refused.status}${refused.reject_reason ? ` (${refused.reject_reason})` : ''}`);
  }
  return body.map((r) => r._id).join(',');
}

// "Adam Foundation <hello@adamfoundation.com>" or a bare address. Quotes pasted
// around the whole value (as in a .env file) are ignored.
function parseAddress(value) {
  const cleaned = String(value ?? '').trim().replace(/^(['"])(.*)\1$/, '$2').replace(/;$/, '').trim();
  const match = cleaned.match(/^(?:"?([^"<]*?)"?\s*)?<([^<>\s]+@[^<>\s]+)>$|^([^<>\s]+@[^<>\s]+)$/);
  if (!match) return null;
  return { name: match[1] || undefined, email: match[2] || match[3] };
}

async function pdfAttachment() {
  const file = path.join(process.cwd(), BOOK_FILE);
  if ((await stat(file)).size > MAX_ATTACH_BYTES) return null;
  const content = (await readFile(file)).toString('base64');
  return { type: 'application/pdf', name: 'Adhkar-Book.pdf', content };
}

const WHATSAPP = 'https://whatsapp.com/channel/0029Vb9M7AwG8l59M3Nk3L3J';
const INSTAGRAM = 'https://www.instagram.com/theadamfdn/';

// Attaches the bundled PDF (when small enough) and links to BOOK_PDF_URL. If
// the file can't be attached, the email still goes out with the link; with
// neither, it throws so the request is marked failed and followed up by hand.
export async function bookEmail({ email, optIn }) {
  const pdfUrl = process.env.BOOK_PDF_URL;
  const attachment = process.env.BOOK_ATTACH_PDF !== 'false'
    ? await pdfAttachment().catch((err) => { console.error('book PDF attach failed', err); return null; })
    : null;
  const attach = Boolean(attachment);
  if (!attach && !pdfUrl) throw new Error('No book to send: PDF not attached and BOOK_PDF_URL is not set');
  const choice = optIn
    ? 'You also asked to receive email updates about our news, events and campaigns. You can unsubscribe at any time.'
    : 'You did not sign up for marketing emails, so we will not send you any.';

  const text = [
    'Thank you for requesting your free Adhkar book from Adam Foundation.',
    '',
    attach ? `Your copy is attached to this email.${pdfUrl ? ' You can also download it here:' : ''}` : 'You can download your copy here:',
    ...(pdfUrl ? [pdfUrl] : []),
    '',
    'Stay connected:',
    `WhatsApp channel: ${WHATSAPP}`,
    `Instagram: ${INSTAGRAM}`,
    '',
    `You are receiving this email because ${email} was entered at connect.adamfoundation.com to request the Adhkar book. ${choice}`,
    '',
    'Adam Foundation',
  ].join('\n');

  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f4f6fa;font-family:Arial,sans-serif;color:#061238">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-top:5px solid #0055b8">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#0055a7">ADAM FOUNDATION</p>
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25">Your free Adhkar book</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Thank you for requesting your free Adhkar book. ${attach ? 'Your copy is attached to this email.' : ''}</p>
${pdfUrl ? `<p style="margin:0 0 24px"><a href="${escapeHtml(pdfUrl)}" style="display:inline-block;background:#0055b8;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:3px;font-size:15px">Download the Adhkar book</a></p>` : ''}
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Stay connected with us:</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.8"><a href="${WHATSAPP}" style="color:#0055b8">Join our WhatsApp channel</a><br><a href="${INSTAGRAM}" style="color:#0055b8">Follow us on Instagram</a></p>
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #c9d7e7;font-size:12px;line-height:1.6;color:#4b566d">
You are receiving this email because ${escapeHtml(email)} was entered at connect.adamfoundation.com to request the Adhkar book. ${choice}
</td></tr></table></td></tr></table></body></html>`;

  return {
    to: email,
    subject: 'Your free Adhkar book from Adam Foundation',
    html,
    text,
    attachments: attachment ? [attachment] : undefined,
    tags: ['adhkar-book'],
  };
}
