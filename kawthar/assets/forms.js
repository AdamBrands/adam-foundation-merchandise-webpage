// Kawthar forms: field definitions and validation.
//
// This one file is loaded by the page (kawthar/assets/app.js) and imported by
// the server (api/kawthar.js), so the browser and the server always apply the
// same rules. Keep it free of browser-only and Node-only code.
//
// If you change the wording of UPDATES_LABEL, update KAWTHAR_CONSENT_TEXT in
// api/_lib/consent.js to match and bump KAWTHAR_CONSENT_VERSION.

export const UPDATES_LABEL =
  'I would also like email news from Adam Foundation, including Community Exchange Hub, Avicenna Foundation and Adam Hub. (Optional)';

const FUND = 'Fund additional bottles';

// Field options:
//   name, label, kind, required
//   noun     words used in "Enter …" / "Select …" messages
//   min/max  length for text, value for numbers
//   options  for selects
//   showIf   { field, equals }: the field only exists when another has that value
//   payment  overrides used when online payments are on (see paymentField)
//   full     spans both columns in the two-column layout
export const FORMS = {
  mosque: {
    title: 'Apply for Ramadan bottles',
    intro: 'For authorised representatives of UK mosques. Fields marked * are required. We’ll email you a copy of your application.',
    success: 'Thank you. We’ve received your mosque’s application and emailed you a copy. Our team will review it and be in touch. Applications are subject to review and availability.',
    fields: [
      { name: 'mosque', label: 'Mosque name', kind: 'text', required: true, noun: 'the mosque’s name', min: 2, max: 150 },
      { name: 'town', label: 'Town or city', kind: 'text', required: true, noun: 'the town or city', min: 2, max: 100 },
      { name: 'postcode', label: 'UK postcode', kind: 'postcode', required: true, noun: 'the mosque’s postcode' },
      { name: 'name', label: 'Your full name', kind: 'person', required: true, noun: 'your full name', min: 2, max: 100 },
      { name: 'role', label: 'Your role at the mosque', kind: 'text', required: true, noun: 'your role at the mosque', min: 2, max: 100 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'phone', label: 'Telephone number', kind: 'ukphone', required: true, noun: 'a UK telephone number' },
      { name: 'website', label: 'Mosque website (optional)', kind: 'url', required: false, noun: 'the mosque’s website' },
      { name: 'attendance', label: 'Estimated night-prayer attendance', kind: 'int', required: true, noun: 'the estimated attendance', min: 1, max: 100000 },
      { name: 'quantity', label: 'Number of bottles requested', kind: 'int', required: true, noun: 'the number of bottles', min: 1, max: 10000 },
      { name: 'refill', label: 'Drinking-water refill arrangements', kind: 'select', required: true, noun: 'your refill arrangements',
        options: ['Facilities are available', 'We plan to arrange facilities', 'We need help planning facilities'] },
      { name: 'plan', label: 'How will you distribute bottles and encourage refilling?', kind: 'longtext', required: true, noun: 'how you will distribute the bottles', min: 20, max: 2000, full: true },
      { name: 'notes', label: 'Anything else we should know? (optional)', kind: 'longtext', required: false, noun: 'anything else', max: 2000, full: true },
      { name: 'authority', label: 'I am authorised to apply on behalf of this mosque.', kind: 'checkbox', required: true,
        message: 'Confirm you are authorised to apply on behalf of this mosque' },
      { name: 'contact', label: 'I agree to be contacted about this application.', kind: 'checkbox', required: true,
        message: 'Agree to be contacted about this application, so we can review it with you' },
      { name: 'updates', label: UPDATES_LABEL, kind: 'checkbox', required: false },
    ],
  },
  support: {
    title: 'Help us reach 100,000',
    intro: 'Tell us how you would like to contribute. This is an expression of interest, not a payment or binding pledge. Fields marked * are required.',
    introPayments: 'Tell us how you would like to contribute. Choosing to fund bottles takes you to a secure Stripe page to donate; other offers are an expression of interest. Fields marked * are required.',
    success: 'Thank you for offering your support. We’ve emailed you a copy and our team will be in touch to discuss it. No money has been taken and no pledge has been recorded.',
    fields: [
      { name: 'who', label: 'I am enquiring as', kind: 'select', required: true, noun: 'who you are enquiring as',
        options: ['An individual', 'A business', 'A charity or organisation'] },
      { name: 'name', label: 'Your full name', kind: 'person', required: true, noun: 'your full name', min: 2, max: 100 },
      { name: 'org', label: 'Organisation name (optional)', kind: 'text', required: false, noun: 'the organisation’s name', min: 2, max: 150 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'phone', label: 'Telephone number (optional)', kind: 'phone', required: false, noun: 'a telephone number' },
      { name: 'type', label: 'How would you like to help?', kind: 'select', required: true, noun: 'how you would like to help',
        options: [FUND, 'Support drinking-water refills', 'Help with distribution or logistics', 'Volunteer time or skills', 'Discuss another contribution'] },
      { name: 'amount', label: 'Indicative contribution in GBP (optional)', kind: 'money', required: false, noun: 'an amount', min: 1, max: 1000000,
        showIf: { field: 'type', equals: FUND },
        // When online payments are on, this is the donation taken by Stripe.
        payment: { label: 'Indicative contribution in GBP', noun: 'an amount', required: true, min: 1, max: 10000, presets: [10, 25, 50, 100] } },
      { name: 'offer', label: 'Tell us about the support you can offer', kind: 'longtext', required: true, noun: 'the support you can offer', min: 20, max: 2000, full: true,
        payment: { label: 'Message to our team (optional)', noun: 'your message', required: false, min: 0 } },
      { name: 'contact', label: 'I agree to be contacted about this offer of support.', kind: 'checkbox', required: true,
        message: 'Agree to be contacted about your offer, so we can discuss it with you' },
      { name: 'updates', label: UPDATES_LABEL, kind: 'checkbox', required: false },
    ],
  },
  book: {
    title: 'Your free digital adhkar book',
    intro: 'Adhkar are words of remembrance and supplication. Enter your details and we’ll email you the book straight away. Fields marked * are required.',
    success: 'We’ve emailed your free adhkar book. It should arrive in a few minutes. If you can’t see it, please check your junk folder.',
    fields: [
      { name: 'name', label: 'Your name', kind: 'person', required: true, noun: 'your name', min: 2, max: 100 },
      { name: 'email', label: 'Email address', kind: 'email', required: true, noun: 'your email address' },
      { name: 'updates', label: UPDATES_LABEL, kind: 'checkbox', required: false },
    ],
  },
};

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

export const FUND_OPTION = FUND;

// Whether this submission pays online: a support offer to fund bottles,
// while payments are switched on (STRIPE_SECRET_KEY set on the server).
export function isDonation(formKey, raw, payments) {
  return Boolean(payments) && formKey === 'support' && String(raw?.type ?? '').trim() === FUND;
}

// The field as it applies right now. While someone is donating (payments on
// and "Fund additional bottles" chosen), the amount becomes a required
// donation and the offer becomes an optional message.
export function paymentField(field, payments, raw) {
  if (!payments || !field.payment || String(raw?.type ?? '').trim() !== FUND) return field;
  return { ...field, ...field.payment };
}

// Whether a conditional field currently applies (e.g. amount only for funding).
export function isActive(field, raw) {
  if (!field.showIf) return true;
  return asText(raw?.[field.showIf.field]) === field.showIf.equals;
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
// Pass { payments: true } when online payments are on.
// Returns { values, errors }: values holds only known, active fields, and
// errors maps field name to message (empty when the form is valid).
export function validate(formKey, raw, { payments = false } = {}) {
  const form = FORMS[formKey];
  if (!form) return { values: {}, errors: { form: 'Unknown form' } };
  const values = {};
  const errors = {};
  for (const field of form.fields) {
    if (!isActive(field, raw)) continue;
    const result = checkField(paymentField(field, payments, raw), raw?.[field.name]);
    if (result.error) errors[field.name] = result.error;
    else values[field.name] = result.value;
  }
  return { values, errors };
}

function capital(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
