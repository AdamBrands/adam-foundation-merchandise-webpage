import { FORMS, displayValue, submitterName } from '../../kawthar/assets/forms.js';
import { escapeHtml } from './request.js';
import { WHATSAPP } from './email.js';

// Emails for the Kawthar pages (/kawthar and the four audience pages under
// /kawthar/…): a copy for the person who filled in a form, and a notification
// to the team for every form. The book forms' own email is bookEmail() in
// email.js, and donation receipts are sent by donationEmails() below.

const SOCIALS = [
  ['WhatsApp channel', WHATSAPP],
  ['Instagram', 'https://www.instagram.com/theadamfdn/'],
  ['LinkedIn', 'https://www.linkedin.com/company/adamfoundation/'],
  ['TikTok', 'https://www.tiktok.com/@theadamfdn'],
  ['X', 'https://x.com/theadamfdn'],
];

// The page a form lives on, as shown in email footers.
const pageOf = (form) => `connect.adamfoundation.com${FORMS[form]?.page || '/kawthar'}`;

// Team inbox. Comma-separated list allowed; defaults to info@.
export function notifyRecipients() {
  const list = String(process.env.KAWTHAR_NOTIFY_TO || 'info@adamfoundation.com')
    .split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ['info@adamfoundation.com'];
}

// [label, displayed value] for every field that was submitted, leaving out
// the names in `skip` and an unused corporate "starting point".
function rows(formKey, values, skip = []) {
  return FORMS[formKey].fields
    .filter((f) => f.name in values && !skip.includes(f.name))
    .filter((f) => !(f.name === 'partnership_path' && !values[f.name]))
    .map((f) => [f.label.replace(/ \(optional\)$/i, ''), displayValue(f, values[f.name])]);
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
  masjid: {
    subject: 'We’ve received your Kawthar bottle application',
    heading: 'Application received',
    lines: (v) => [
      `Thank you for applying for Kawthar bottles for ${v.mosque}. Our team will review your application and be in touch using the details below.`,
      'Applications are reviewed against available stock and distribution arrangements, so applying does not guarantee a particular quantity.',
    ],
  },
  partner: {
    subject: 'Thank you for your interest in partnering with Kawthar',
    heading: 'Thank you for your enquiry',
    lines: (v) => [
      `Thank you for your interest in partnering with Kawthar on behalf of ${v.organisation}. Our team will be in touch to discuss how you would like to take part.`,
    ],
  },
  // Sent only while online payments are off. With payments on, the receipt
  // comes from donationEmails() once Stripe confirms the payment.
  donation: {
    subject: 'Thank you for your Kawthar pledge',
    heading: 'Thank you for your pledge',
    lines: (v) => [
      `Thank you for pledging £${Number(v.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} to help fund reusable Kawthar bottles.`,
      'Online payment isn’t open yet, so nothing has been charged. Our team will contact you to complete your gift.',
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
    intro: para(`Dear ${escapeHtml(submitterName(form, values))},`) + copy.lines(values).map((l) => para(escapeHtml(l))).join(''),
    inner: `<p style="margin:8px 0 8px;font-size:13px;font-weight:bold;color:#122d45">Your details</p>${tableHtml(list)}
${para('If anything needs correcting, just reply to this email.')}
<p style="margin:0 0 6px;font-size:15px;line-height:1.6">Stay connected with us:</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.8">${socialsHtml}</p>`,
    footer: `You are receiving this email because ${escapeHtml(values.email)} was entered at ${pageOf(form)}. ${choice}`,
  });

  const text = [
    `Dear ${submitterName(form, values)},`, '',
    ...copy.lines(values).flatMap((l) => [l, '']),
    'Your details', tableText(list), '',
    'If anything needs correcting, just reply to this email.', '',
    'Stay connected:', ...SOCIALS.map(([n, u]) => `${n}: ${u}`), '',
    `You are receiving this email because ${values.email} was entered at ${pageOf(form)}. ${choice}`, '',
    'Adam Foundation',
  ].join('\n');

  return { to: values.email, subject: copy.subject, html, text, tags: [`kawthar-${form}`] };
}

const TEAM_SUBJECT = {
  mosque: (v) => `Kawthar mosque application: ${v.mosque}, ${v.town}`,
  support: (v) => `Kawthar support offer: ${v.name}${v.org ? ` (${v.org})` : ''} – ${v.type}`,
  book: (v) => `Kawthar book request: ${v.name}`,
  masjid: (v) => `Kawthar Masjid application: ${v.mosque}, ${v.town} – ${Number(v.quantity).toLocaleString('en-GB')} bottles`,
  partner: (v) => `Kawthar partnership enquiry: ${v.organisation} – ${v.interest}`,
  donation: (v) => `Kawthar pledge: £${Number(v.amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} from ${submitterName('donation', v)}`,
  bottle: (v) => `Kawthar book request (bottle QR): ${v.name}`,
};

const TEAM_HEADING = {
  mosque: 'New mosque application',
  support: 'New offer of support',
  book: 'New adhkar book request',
  masjid: 'New Masjid application',
  partner: 'New partnership enquiry',
  donation: 'New pledge (payment not taken)',
  bottle: 'New adhkar book request (bottle QR)',
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
  const heading = TEAM_HEADING[form];
  const name = submitterName(form, values);

  const html = layout({
    heading,
    intro: para(`Submitted on ${escapeHtml(pageOf(form))} by ${escapeHtml(name)} (<a href="mailto:${escapeHtml(values.email)}" style="color:#264f70">${escapeHtml(values.email)}</a>). Reply to this email to answer them directly.`),
    inner: tableHtml(list) + tableHtml(meta),
    footer: `Sent automatically from ${pageOf(form)}. Marketing consent: ${values.updates ? 'opted in' : 'not given'}.`,
  });
  const text = [
    `${heading} from ${pageOf(form)}.`, '',
    tableText(list), '', tableText(meta), '',
    `Reply to this email to answer ${name} directly.`,
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
  const form = FORMS[submission.form] ? submission.form : 'support';
  const name = submitterName(form, values);
  const org = values.org || values.organisation;
  const optIn = submission.marketing_opt_in;
  const list = rows(form, values, ['amount']);
  const choice = optIn
    ? 'You also asked to receive email news from Adam Foundation. You can unsubscribe at any time.'
    : 'You did not sign up for marketing emails, so we will not send you any.';
  const socialsHtml = SOCIALS.map(([n, u]) => `<a href="${u}" style="color:#264f70">${n}</a>`).join(' · ');
  const summary = [['Donation', amount], ['Payment reference', reference], ['Paid', new Date().toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'long', timeStyle: 'short' })]];

  const receiptHtml = layout({
    heading: 'Thank you for your donation',
    intro: para(`Dear ${escapeHtml(name)},`)
      + para(`Thank you for donating <strong>${escapeHtml(amount)}</strong> to help fund reusable Kawthar bottles for UK mosques this Ramadan. Your gift helps us move from our first 10,000 bottles towards our shared goal of 100,000.`)
      + (form === 'support' ? para('Our team will also be in touch about the support you described.') : ''),
    inner: `${tableHtml(summary)}
<p style="margin:8px 0 8px;font-size:13px;font-weight:bold;color:#122d45">Your details</p>${tableHtml(list)}
${para('Please keep this email as a record of your donation. If anything needs correcting, just reply to it.')}
<p style="margin:0 0 6px;font-size:15px;line-height:1.6">Stay connected with us:</p>
<p style="margin:0 0 24px;font-size:14px;line-height:1.8">${socialsHtml}</p>`,
    footer: `You are receiving this email because ${escapeHtml(values.email)} made a donation at ${pageOf(form)}. ${choice}`,
  });
  const receiptText = [
    `Dear ${name},`, '',
    `Thank you for donating ${amount} to help fund reusable Kawthar bottles for UK mosques this Ramadan.`, '',
    tableText(summary), '', 'Your details', tableText(list), '',
    'Please keep this email as a record of your donation.', '',
    'Stay connected:', ...SOCIALS.map(([n, u]) => `${n}: ${u}`), '',
    `You are receiving this email because ${values.email} made a donation at ${pageOf(form)}. ${choice}`, '', 'Adam Foundation',
  ].join('\n');

  const meta = [['Donation', amount], ['Payment reference', reference], ['Source', submission.source], ['Reference', `kawthar_submissions #${submission.id}`]];
  const notifyHtml = layout({
    heading: `New donation: ${escapeHtml(amount)}`,
    intro: para(`${escapeHtml(name)} (<a href="mailto:${escapeHtml(values.email)}" style="color:#264f70">${escapeHtml(values.email)}</a>) donated ${escapeHtml(amount)} through Stripe on ${escapeHtml(pageOf(form))}. Reply to this email to answer them directly.`),
    inner: tableHtml(meta) + tableHtml(list),
    footer: `Sent automatically from ${pageOf(form)}. Marketing consent: ${optIn ? 'opted in' : 'not given'}.`,
  });
  const notifyText = [`New Kawthar donation: ${amount}`, '', tableText(meta), '', tableText(list)].join('\n');

  return {
    receipt: { to: values.email, subject: `Thank you for your ${amount} Kawthar donation`, html: receiptHtml, text: receiptText, tags: ['kawthar-donation'] },
    notify: {
      to: notifyRecipients(), replyTo: values.email,
      subject: `Kawthar donation: ${amount} from ${name}${org ? ` (${org})` : ''}`.slice(0, 180),
      html: notifyHtml, text: notifyText, tags: ['kawthar-notify'],
    },
  };
}
