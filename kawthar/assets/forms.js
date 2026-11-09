// Kawthar forms: field definitions and validation.
//
// This one file is loaded by the four Kawthar pages (kawthar/assets/audience.js)
// and imported by the server (api/kawthar.js), so the browser and the server
// always apply the same rules. Keep it free of browser-only and Node-only code.

// Marketing checkbox wording on the four audience pages, word for word as the
// pages show it. Each submission stores the wording its form showed. If any of
// these change, update the page to match and bump AUDIENCE_CONSENT_VERSION.
export const AUDIENCE_UPDATES = {
  masjid: 'Send me occasional emails from Adam Foundation, including Community Exchange Hub news and events. I can unsubscribe at any time. Optional.',
  partner: 'Send me occasional Adam Foundation emails about our work and opportunities to get involved. I can unsubscribe at any time. Optional.',
  donation: 'Keep me updated by email on Kawthar and Adam Foundation’s work. I can unsubscribe at any time. Optional.',
  bottle: 'Keep me updated by email with Community Exchange Hub news, events and Adam Foundation activities. I can unsubscribe at any time. Optional.',
};
export const AUDIENCE_CONSENT_VERSION = '2026-11-kawthar-audience-v1';

// Field options:
//   name, label, kind, required
//   noun     words used in "Enter …" / "Select …" messages
//   min/max  length for text, value for numbers
//   options  for selects (optionLabels: how a value reads in reviews and emails)
//   presets  suggested amounts for money
export const FORMS = {
  // The four Kawthar pages (/donate, /masjids, /bottle, /corporate).
  // Their fields and checkbox wording come from the comms team's designs, and
  // the markup lives in each page; kawthar/assets/audience.js checks that every
  // field below exists there and that `updatesLabel` matches the page's wording.
  masjid: {
    page: '/masjids',
    heading: 'Application received',
    success: 'Thank you. We’ve received your Masjid’s application and emailed you a copy. Our team will review it and be in touch. An application does not guarantee an allocation.',
    updatesLabel: AUDIENCE_UPDATES.masjid,
    consentVersion: AUDIENCE_CONSENT_VERSION,
    fields: [
      { name: 'mosque', label: 'Masjid name', kind: 'text', required: true, noun: 'the Masjid’s name', min: 2, max: 160 },
      { name: 'town', label: 'Town or city', kind: 'text', required: true, noun: 'the town or city', min: 2, max: 100 },
      { name: 'postcode', label: 'UK postcode', kind: 'postcode', required: true, noun: 'the Masjid’s postcode' },
      { name: 'name', label: 'Your full name', kind: 'person', required: true, noun: 'your full name', min: 2, max: 100 },
      { name: 'role', label: 'Your role at the Masjid', kind: 'text', required: true, noun: 'your role at the Masjid', min: 2, max: 100 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'phone', label: 'Telephone number', kind: 'ukphone', required: true, noun: 'a UK telephone number' },
      { name: 'quantity', label: 'Number of bottles requested', kind: 'int', required: true, noun: 'the number of bottles', min: 1, max: 10000 },
      { name: 'refill', label: 'Drinking-water refill facilities', kind: 'select', required: true, noun: 'your refill facilities',
        options: ['Available at our mosque', 'We plan to arrange them', 'We need help planning them'] },
      { name: 'notes', label: 'Anything else we should know? (optional)', kind: 'longtext', required: false, noun: 'anything else', max: 1500 },
      { name: 'authority', label: 'I am authorised to apply on behalf of this Masjid.', kind: 'checkbox', required: true,
        message: 'Confirm you are authorised to apply on behalf of this Masjid' },
      { name: 'updates', label: 'Email updates (optional)', kind: 'checkbox', required: false },
    ],
  },
  partner: {
    page: '/corporate',
    heading: 'Thank you for your enquiry',
    success: 'Thank you. We’ve received your partnership enquiry and emailed you a copy. Our team will be in touch to discuss it.',
    updatesLabel: AUDIENCE_UPDATES.partner,
    consentVersion: AUDIENCE_CONSENT_VERSION,
    fields: [
      { name: 'partnership_path', label: 'Starting point', kind: 'select', required: false, noun: 'a starting point',
        options: ['fund_bottles', 'share_expertise', 'involve_team', 'share_message'],
        optionLabels: { fund_bottles: 'Fund the next bottles', share_expertise: 'Share your expertise', involve_team: 'Involve your team', share_message: 'Help the message travel' } },
      { name: 'organisation', label: 'Organisation name', kind: 'text', required: true, noun: 'your organisation’s name', min: 2, max: 160 },
      { name: 'name', label: 'Your name', kind: 'person', required: true, noun: 'your name', min: 2, max: 100 },
      { name: 'email', label: 'Work email', kind: 'email', required: true, noun: 'your work email address' },
      { name: 'phone', label: 'Telephone number (optional)', kind: 'phone', required: false, noun: 'a telephone number' },
      { name: 'interest', label: 'Partnership interest', kind: 'select', required: true, noun: 'your partnership interest',
        options: ['Bottle Sponsorship', 'Charity / Donation', 'Masjid Support', 'Corporate Partnership', 'Community Engagement', 'Other'] },
      { name: 'message', label: 'What would you like to contribute?', kind: 'longtext', required: true, noun: 'what you would like to contribute', min: 20, max: 2000 },
      { name: 'updates', label: 'Email updates (optional)', kind: 'checkbox', required: false },
    ],
  },
  donation: {
    page: '/donate',
    heading: 'Thank you for your pledge',
    // Used only while online payments are off: the gift is recorded as a
    // pledge and the team arranges payment. With payments on, the donor goes
    // to Stripe and api/stripe-webhook.js sends the receipt.
    success: 'Thank you. We’ve recorded your pledge and emailed you a copy. Online payment isn’t open yet, so our team will contact you to complete your gift. Nothing has been charged.',
    updatesLabel: AUDIENCE_UPDATES.donation,
    consentVersion: AUDIENCE_CONSENT_VERSION,
    fields: [
      { name: 'amount', label: 'Donation', kind: 'money', required: true, noun: 'an amount', min: 1, max: 10000, presets: [10, 25, 50, 100] },
      { name: 'first_name', label: 'First name', kind: 'person', required: true, noun: 'your first name', min: 1, max: 100 },
      { name: 'last_name', label: 'Last name', kind: 'person', required: true, noun: 'your last name', min: 1, max: 100 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'phone', label: 'Phone number (optional)', kind: 'phone', required: false, noun: 'a phone number' },
      { name: 'country', label: 'Country', kind: 'text', required: true, noun: 'your country', min: 2, max: 100 },
      { name: 'organisation', label: 'Organisation name (optional)', kind: 'text', required: false, noun: 'the organisation’s name', min: 2, max: 160 },
      { name: 'dedication', label: 'On behalf of (optional)', kind: 'text', required: false, noun: 'the name the gift is on behalf of', min: 2, max: 150 },
      { name: 'message', label: 'Anything you would like us to know? (optional)', kind: 'longtext', required: false, noun: 'your message', max: 1000 },
      { name: 'updates', label: 'Email updates (optional)', kind: 'checkbox', required: false },
    ],
  },
  bottle: {
    page: '/bottle',
    heading: 'Check your inbox',
    success: 'We’ve emailed your free adhkar book. It should arrive in a few minutes. If you can’t see it, please check your junk folder.',
    updatesLabel: AUDIENCE_UPDATES.bottle,
    consentVersion: AUDIENCE_CONSENT_VERSION,
    fields: [
      { name: 'name', label: 'Your name', kind: 'person', required: true, noun: 'your name', min: 2, max: 100 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'updates', label: 'Email updates (optional)', kind: 'checkbox', required: false },
    ],
  },
};

// Who a submission is from, for the database row and email greetings.
export function submitterName(formKey, values) {
  const name = formKey === 'donation'
    ? `${values?.first_name ?? ''} ${values?.last_name ?? ''}`.trim()
    : String(values?.name ?? '').trim();
  return name.slice(0, 100);
}

// The marketing checkbox wording a form showed, and its consent version.
export function consentFor(formKey) {
  const form = FORMS[formKey];
  return { text: form?.updatesLabel ?? '', version: form?.consentVersion ?? AUDIENCE_CONSENT_VERSION };
}

// A validated answer as people read it (review step and emails).
export function displayValue(field, value) {
  if (field.kind === 'checkbox') return value ? 'Yes' : 'No';
  if (value === '' || value == null) return 'Not provided';
  if (field.kind === 'money') return `£${Number(value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (field.kind === 'int') return Number(value).toLocaleString('en-GB');
  if (field.optionLabels?.[value]) return field.optionLabels[value];
  return String(value);
}

// Same pattern as api/book-request.js.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Letters from any alphabet, with spaces, apostrophes, hyphens, dots and commas.
const PERSON_RE = /^[\p{L}\p{M}][\p{L}\p{M}'’\-., ]*$/u;
const HAS_LETTER_RE = /\p{L}/u;
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
// UK postcodes, including GIR 0AA.
const POSTCODE_RE = /^(GIR ?0AA|[A-PR-UWYZ][A-HK-Y]?[0-9][0-9A-HJKMNPR-Y]? ?[0-9][ABD-HJLNP-UW-Z]{2})$/i;

const asText = (value) => (value == null ? '' : String(value)).replace(/\r\n?/g, '\n').trim();
const isChecked = (value) => value === true || value === 'true' || value === 'on' || value === 'yes';
const plural = (n) => Number(n).toLocaleString('en-GB');

// Whether this submission pays online: the Donate page's form, while online
// payments are switched on (STRIPE_SECRET_KEY set on the server).
export function isDonation(formKey, payments) {
  return Boolean(payments) && formKey === 'donation';
}

// Checks one field. Returns { value } (normalised) or { error }.
export function checkField(field, rawValue) {
  if (field.kind === 'checkbox') {
    const checked = isChecked(rawValue);
    if (field.required && !checked) return { error: field.message || `Tick “${field.label}”` };
    return { value: checked };
  }

  const text = asText(rawValue);
  if (!text) {
    if (!field.required) return { value: field.kind === 'int' || field.kind === 'money' ? null : '' };
    return { error: `${field.kind === 'select' ? 'Select' : 'Enter'} ${field.noun}` };
  }
  if (CONTROL_RE.test(text)) return { error: `Remove any unusual characters from ${field.noun}` };

  switch (field.kind) {
    case 'person':
    case 'text': {
      if (field.kind === 'person' && !PERSON_RE.test(text)) {
        return { error: `${capital(field.noun)} must only include letters, spaces, hyphens and apostrophes` };
      }
      if (field.kind === 'text' && !HAS_LETTER_RE.test(text)) return { error: `Enter ${field.noun} using letters` };
      if (text.length < field.min) return { error: `${capital(field.noun)} must be at least ${field.min} characters` };
      if (text.length > field.max) return { error: `${capital(field.noun)} must be ${field.max} characters or fewer` };
      return { value: text.replace(/\s+/g, ' ') };
    }
    case 'longtext': {
      if (field.min && text.length < field.min) {
        return { error: `Tell us a little more about ${field.noun} (at least ${field.min} characters)` };
      }
      if (text.length > field.max) return { error: `${capital(field.noun)} must be ${plural(field.max)} characters or fewer` };
      return { value: text };
    }
    case 'email': {
      if (text.length > 254 || !EMAIL_RE.test(text)) {
        return { error: 'Enter an email address in the correct format, like name@example.com' };
      }
      return { value: text };
    }
    case 'postcode': {
      const compact = text.replace(/\s+/g, '').toUpperCase();
      if (!POSTCODE_RE.test(compact)) return { error: 'Enter a real UK postcode, like SW1P 4QP' };
      return { value: `${compact.slice(0, -3)} ${compact.slice(-3)}` };
    }
    case 'ukphone':
    case 'phone': {
      if (!/^[0-9+()\-. ]+$/.test(text)) {
        return { error: 'Telephone number must only include numbers, spaces, brackets, hyphens and +' };
      }
      const digits = text.replace(/\(0\)/g, '').replace(/[^0-9+]/g, '').replace(/^00/, '+');
      const uk = /^0\d{9,10}$/.test(digits) || /^\+44\d{9,10}$/.test(digits);
      const international = /^\+[1-9]\d{7,14}$/.test(digits);
      if (field.kind === 'ukphone' && !uk) return { error: 'Enter a UK telephone number, like 020 7946 0000 or 07700 900000' };
      if (!uk && !international) {
        return { error: 'Enter a telephone number, like 020 7946 0000, or include the country code, like +90 212 000 0000' };
      }
      return { value: text.replace(/\s+/g, ' ') };
    }
    case 'url': {
      const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
      let url;
      try { url = new URL(withScheme); } catch { url = null; }
      if (!url || !/^https?:$/.test(url.protocol) || !/^[^.]+(\.[^.]+)+$/.test(url.hostname) || withScheme.length > 200 || /\s/.test(text)) {
        return { error: 'Enter a website address in the correct format, like www.example.org.uk' };
      }
      return { value: url.href };
    }
    case 'int': {
      const cleaned = text.replace(/,/g, '');
      if (!/^\d+$/.test(cleaned)) return { error: `Enter ${field.noun} as a whole number, like 250` };
      const n = Number(cleaned);
      if (n < field.min || n > field.max) {
        return { error: `${capital(field.noun)} must be between ${plural(field.min)} and ${plural(field.max)}` };
      }
      return { value: n };
    }
    case 'money': {
      const cleaned = text.replace(/^£/, '').replace(/,/g, '').trim();
      if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return { error: 'Enter an amount in pounds, like 500 or 500.00' };
      const n = Number(cleaned);
      if (n < field.min || n > field.max) return { error: `Amount must be between £${plural(field.min)} and £${plural(field.max)}` };
      return { value: n };
    }
    case 'select': {
      if (!field.options.includes(text)) return { error: `Select ${field.noun}` };
      return { value: text };
    }
    default:
      return { error: 'This field is not recognised' };
  }
}

// Validates a whole form. `raw` is a plain object of field name to value.
// Returns { values, errors }: values holds only the form's known fields, and
// errors maps field name to message (empty when the form is valid).
export function validate(formKey, raw) {
  const form = FORMS[formKey];
  if (!form) return { values: {}, errors: { form: 'Unknown form' } };
  const values = {};
  const errors = {};
  for (const field of form.fields) {
    const result = checkField(field, raw?.[field.name]);
    if (result.error) errors[field.name] = result.error;
    else values[field.name] = result.value;
  }
  return { values, errors };
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
