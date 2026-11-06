import { FORMS } from '../../kawthar/assets/forms.js';
import { escapeHtml } from './request.js';
import { WHATSAPP } from './email.js';

// Emails for the Kawthar page (/kawthar): a copy for the person who filled in
// the mosque or support form, and a notification to the team for all three
// forms. The book form's own email is bookEmail() in email.js.

const SOCIALS = [
  ['WhatsApp channel', WHATSAPP],
  ['Instagram', 'https://www.instagram.com/theadamfdn/'],
  ['LinkedIn', 'https://www.linkedin.com/company/adamfoundation/'],
  ['TikTok', 'https://www.tiktok.com/@theadamfdn'],
  ['X', 'https://x.com/theadamfdn'],
];

const PAGE = 'connect.adamfoundation.com/kawthar';

// Team inbox. Comma-separated list allowed; defaults to info@.
export function notifyRecipients() {
  const list = String(process.env.KAWTHAR_NOTIFY_TO || 'info@adamfoundation.com')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['info@adamfoundation.com'];
}

function display(field, value) {
  if (field.kind === 'checkbox') return value ? 'Yes' : 'No';
  if (value === '' || value == null) return 'Not provided';
  if (field.kind === 'money') return `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (field.kind === 'int') return Number(value).toLocaleString('en-GB');
  return String(value);
}

// [label, displayed value] for every field that was submitted.
function rows(formKey, values) {
  return FORMS[formKey].fields
    .filter((f) => f.name in values)
    .map((f) => [f.label.replace(/ \(optional\)$/i, ''), display(f, values[f.name])]);
}

function tableHtml(list) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px">${
    list.map(([k, v]) => `<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #dfdfd8;font-size:12px;color:#62717b;vertical-align:top;width:40%">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #dfdfd8;font-size:14px;color:#183247;white-space:pre-wrap;word-break:break-word">${escapeHtml(v)}</td></tr>`).join('')
  }</table>`;
}

const tableText = (list) => list.map(([k, v]) => `${k}: ${v}`).join('\n');

function layout({ heading, intro, inner, footer }) {
  return `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f6f3ec;font-family:Arial,sans-serif;color:#183247">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f3ec;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-top:5px solid #af9058">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;color:#8b6e39">ADAM FOUNDATION · KAWTHAR</p>
<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.25;color:#122d45">${heading}</h1>
${intro}
${inner}
</td></tr>
<tr><td style="padding:16px 28px 24px;border-top:1px solid #dfdfd8;font-size:12px;line-height:1.6;color:#62717b">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

const para = (text) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${text}</p>`;

const COPY = {
  mosque: {
    subject: 'We’ve received your Kawthar bottle application',
    heading: 'Application received',
    lines: (v) => [
      `Thank you for applying for Kawthar bottles for ${v.mosque}. Our team will review your application and be in touch using the details below.`,
      'Applications are subject to review and availability, so submitting does not guarantee an allocation.',
    ],
  },
  support: {
    subject: 'Thank you for offering to support Kawthar',
    heading: 'Thank you for your support',
    lines: () => [
      'Thank you for offering to help Kawthar reach 100,000 bottles. Our team will be in touch to discuss your offer.',
      'This is an expression of interest only: no payment has been taken and no pledge has been recorded.',
    ],
  },
};

// Copy of the mosque or support form for the person who sent it.
export function confirmationEmail({ form, values, optIn }) {
  const copy = COPY[form];
  const list = rows(form, values);
  const choice = optIn
    ? 'You also asked to receive email news from Adam Foundation. You can unsubscribe at any time.'
    : 'You did not sign up for marketing emails, so we will not send you any.';
  const socialsHtml = SOCIALS.map(([n, u]) => `<a href="${u}" style="color:#264f70">${n}</a>`).join(' · ');

  const html = layout({
    heading: copy.heading,
    intro: para(`Dear ${escapeHtml(values.name)},`) + copy.lines(values).map((l) => para(escapeHtml(l))).join(''),
    inner: `<p style="margin:8px 0 8px;font-size:13px;font-weight:bold;color:#122d45">Your details</p>${tableHtml(list)}
${para('If anything needs correcting, just reply to this email.')}
<p style="margin:0 0 6px;font-size:15px;line-height:1.6">Stay connected with us:</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.8">${socialsHtml}</p>`,
    footer: `You are receiving this email because ${escapeHtml(values.email)} was entered at ${PAGE}. ${choice}`,
  });

  const text = [
    `Dear ${values.name},`, '',
    ...copy.lines(values).flatMap((l) => [l, '']),
    'Your details', tableText(list), '',
    'If anything needs correcting, just reply to this email.', '',
    'Stay connected:', ...SOCIALS.map(([n, u]) => `${n}: ${u}`), '',
    `You are receiving this email because ${values.email} was entered at ${PAGE}. ${choice}`, '',
    'Adam Foundation',
  ].join('\n');

  return { to: values.email, subject: copy.subject, html, text, tags: [`kawthar-${form}`] };
}

const TEAM_SUBJECT = {
  mosque: (v) => `Kawthar mosque application: ${v.mosque}, ${v.town}`,
  support: (v) => `Kawthar support offer: ${v.name}${v.org ? ` (${v.org})` : ''} – ${v.type}`,
  book: (v) => `Kawthar book request: ${v.name}`,
};

// Notification to the team. Reply-To is the visitor, so staff can answer directly.
export function notificationEmail({ form, values, id, source, personEmailed }) {
  const list = rows(form, values);
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'full', timeStyle: 'short' });
  const meta = [
    ['Submitted', `${when} (UK time)`],
    ['Source', source],
    ['Reference', `kawthar_submissions #${id}`],
    ['Copy emailed to them', personEmailed ? 'Yes' : 'No: please follow up by hand'],
  ];
  const heading = { mosque: 'New mosque application', support: 'New offer of support', book: 'New adhkar book request' }[form];

  const html = layout({
    heading,
    intro: para(`Submitted on the Kawthar page by ${escapeHtml(values.name)} (<a href="mailto:${escapeHtml(values.email)}" style="color:#264f70">${escapeHtml(values.email)}</a>). Reply to this email to answer them directly.`),
    inner: tableHtml(list) + tableHtml(meta),
    footer: `Sent automatically from ${PAGE}. Marketing consent: ${values.updates ? 'opted in' : 'not given'}.`,
  });
  const text = [
    `${heading} from the Kawthar page.`, '',
    tableText(list), '', tableText(meta), '',
    `Reply to this email to answer ${values.name} directly.`,
  ].join('\n');

  return {
    to: notifyRecipients(),
    replyTo: values.email,
    subject: TEAM_SUBJECT[form](values).slice(0, 180),
    html,
    text,
    tags: ['kawthar-notify'],
  };
}

// Sent by api/stripe-webhook.js once Stripe confirms a donation.
export function donationEmails({ submission, amount, reference }) {
  const values = submission.data;
  const optIn = submission.marketing_opt_in;
  const list = rows('support', values).filter(([k]) => !/^Indicative contribution/.test(k));
  const choice = optIn
    ? 'You also asked to receive email news from Adam Foundation. You can unsubscribe at any time.'
    : 'You did not sign up for marketing emails, so we will not send you any.';
  const socialsHtml = SOCIALS.map(([n, u]) => `<a href="${u}" style="color:#264f70">${n}</a>`).join(' · ');
  const summary = [['Donation', amount], ['Payment reference', reference], ['Paid', new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' })]];

  const receiptHtml = layout({
    heading: 'Thank you for your donation',
    intro: para(`Dear ${escapeHtml(values.name)},`)
      + para(`Thank you for donating <strong>${escapeHtml(amount)}</strong> to help fund reusable Kawthar bottles for UK mosques this Ramadan. Your gift helps us move from our first 10,000 bottles towards our shared goal of 100,000.`)
      + para('Our team will also be in touch about the support you described.'),
    inner: `${tableHtml(summary)}
<p style="margin:8px 0 8px;font-size:13px;font-weight:bold;color:#122d45">Your details</p>${tableHtml(list)}
${para('Please keep this email as a record of your donation. If anything needs correcting, just reply to it.')}
<p style="margin:0 0 6px;font-size:15px;line-height:1.6">Stay connected with us:</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.8">${socialsHtml}</p>`,
    footer: `You are receiving this email because ${escapeHtml(values.email)} made a donation at ${PAGE}. ${choice}`,
  });
  const receiptText = [
    `Dear ${values.name},`, '',
    `Thank you for donating ${amount} to help fund reusable Kawthar bottles for UK mosques this Ramadan.`, '',
    tableText(summary), '', 'Your details', tableText(list), '',
    'Please keep this email as a record of your donation.', '',
    'Stay connected:', ...SOCIALS.map(([n, u]) => `${n}: ${u}`), '',
    `You are receiving this email because ${values.email} made a donation at ${PAGE}. ${choice}`, '', 'Adam Foundation',
  ].join('\n');

  const meta = [['Donation', amount], ['Payment reference', reference], ['Source', submission.source], ['Reference', `kawthar_submissions #${submission.id}`]];
  const notifyHtml = layout({
    heading: `New donation: ${escapeHtml(amount)}`,
    intro: para(`${escapeHtml(values.name)} (<a href="mailto:${escapeHtml(values.email)}" style="color:#264f70">${escapeHtml(values.email)}</a>) donated ${escapeHtml(amount)} through Stripe on the Kawthar page. Reply to this email to answer them directly.`),
    inner: tableHtml(meta) + tableHtml(list),
    footer: `Sent automatically from ${PAGE}. Marketing consent: ${optIn ? 'opted in' : 'not given'}.`,
  });
  const notifyText = [`New Kawthar donation: ${amount}`, '', tableText(meta), '', tableText(list)].join('\n');

  return {
    receipt: { to: values.email, subject: `Thank you for your ${amount} Kawthar donation`, html: receiptHtml, text: receiptText, tags: ['kawthar-donation'] },
    notify: {
      to: notifyRecipients(), replyTo: values.email,
      subject: `Kawthar donation: ${amount} from ${values.name}${values.org ? ` (${values.org})` : ''}`.slice(0, 180),
      html: notifyHtml, text: notifyText, tags: ['kawthar-notify'],
    },
  };
}
