import { escapeHtml } from './request.js';

// Sends through the Resend HTTP API. Returns the Resend email id.
export async function sendEmail({ to, subject, html, text, attachments }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  if (!process.env.MAIL_FROM) throw new Error('MAIL_FROM is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.MAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      reply_to: process.env.MAIL_REPLY_TO || undefined,
      subject,
      html,
      text,
      attachments,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Resend responded ${res.status}`);
  return body.id;
}

const WHATSAPP = 'https://whatsapp.com/channel/0029Vb9M7AwG8l59M3Nk3L3J';
const INSTAGRAM = 'https://www.instagram.com/theadamfdn/';

export function bookEmail({ email, optIn }) {
  const pdfUrl = process.env.BOOK_PDF_URL;
  const attach = Boolean(pdfUrl) && process.env.BOOK_ATTACH_PDF !== 'false';
  const choice = optIn
    ? 'You also asked to receive email updates about our news, events and campaigns. You can unsubscribe at any time.'
    : 'You did not sign up for marketing emails, so we will not send you any.';

  const text = [
    'Thank you for requesting your free Adhkar book from Adam Foundation.',
    '',
    attach ? 'Your copy is attached to this email. You can also download it here:' : 'You can download your copy here:',
    pdfUrl || '',
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
    attachments: attach ? [{ filename: 'Adhkar-Book.pdf', path: pdfUrl }] : undefined,
  };
}
