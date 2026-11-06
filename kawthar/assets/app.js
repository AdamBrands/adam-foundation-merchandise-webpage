// Kawthar forms: modal, live validation, review step and submission.
// Field definitions and rules live in forms.js, shared with api/kawthar.js.
//
// Validation feel: a field is only marked wrong once the person has left it
// (or pressed Review), but it turns green as soon as it is right, and once
// marked, its message updates live as they type.
import { FORMS, validate, checkField, isActive, isDonation, paymentField } from './forms.js';

const modal = document.querySelector('#flow');
const body = document.querySelector('#form-body');
const PRIVACY_URL = 'https://adamfoundation.com/privacy-policy/';
const HEADINGS = { mosque: 'Application received', support: 'Thank you for your support', book: 'Check your inbox' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// QR codes and campaign links arrive as ?src=<code>; everything else is "kawthar".
const srcParam = new URLSearchParams(location.search).get('src');
const source = srcParam && /^[a-z0-9-]{1,40}$/.test(srcParam) ? srcParam : 'kawthar';

const INPUT_TYPES = { email: 'email', ukphone: 'tel', phone: 'tel', url: 'url' };
const INPUT_MODES = { email: 'email', ukphone: 'tel', phone: 'tel', url: 'url', int: 'numeric', money: 'decimal' };
const MAX_LENGTHS = { email: 254, postcode: 8, ukphone: 25, phone: 25, url: 200, int: 9, money: 15 };
const AUTOCOMPLETE = { name: 'name', email: 'email', phone: 'tel', postcode: 'postal-code', org: 'organization', town: 'address-level2', website: 'url' };
const PLACEHOLDERS = { postcode: 'e.g. SW1P 4QP', email: 'name@example.com', ukphone: 'e.g. 07700 900000', url: 'www.example.org.uk', money: '£' };

// Common email domains, for "Did you mean …?" when someone mistypes one.
const DOMAINS = ['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'btinternet.com', 'aol.com', 'msn.com', 'sky.com', 'virginmedia.com'];

let opener;
let key;
let config;
let form;
let touched;
let sending = false;

// Online donations are on when the server has Stripe keys (GET /api/kawthar).
// Until we hear back, or if the check fails, the form works without them.
let payments = false;
const paymentsReady = fetch('/api/kawthar', { headers: { Accept: 'application/json' } })
  .then((r) => (r.ok ? r.json() : {}))
  .then((d) => { payments = Boolean(d.payments); })
  .catch(() => {});

function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

const fieldOf = (name) => {
  const field = config.fields.find((f) => f.name === name);
  return field && paymentField(field, payments, readValues());
};
const boxOf = (name) => form.querySelector(`[data-field="${name}"]`);
const valueOf = (field) => {
  const input = form.elements[field.name];
  return field.kind === 'checkbox' ? input.checked : input.value;
};

function buildField(baseField) {
  // Built with the donation version of fields that have one (labels are
  // switched back by syncDonation when another way of helping is chosen).
  const field = paymentField(baseField, payments, { type: 'Fund additional bottles' });
  const wide = field.full || field.kind === 'longtext' || field.kind === 'checkbox';
  const box = node('div', `${wide ? 'full ' : ''}field`);
  box.dataset.field = field.name;
  const id = `input-${field.name}`;
  const msg = node('span', 'field-msg');
  msg.id = `msg-${field.name}`;

  let input;
  if (field.kind === 'longtext') {
    input = document.createElement('textarea');
  } else if (field.kind === 'select') {
    input = document.createElement('select');
    const blank = node('option', '', 'Select an option');
    blank.value = '';
    input.append(blank);
    field.options.forEach((v) => {
      const opt = node('option', '', v);
      opt.value = v;
      input.append(opt);
    });
  } else {
    input = document.createElement('input');
    input.type = field.kind === 'checkbox' ? 'checkbox' : (INPUT_TYPES[field.kind] || 'text');
  }
  input.id = id;
  input.name = field.name;
  input.setAttribute('aria-describedby', msg.id);
  if (field.required) input.setAttribute('aria-required', 'true');
  const max = field.max && field.kind !== 'int' && field.kind !== 'money' ? field.max : MAX_LENGTHS[field.kind];
  if (max && field.kind !== 'select' && field.kind !== 'checkbox') input.maxLength = max;
  if (INPUT_MODES[field.kind]) input.inputMode = INPUT_MODES[field.kind];
  if (AUTOCOMPLETE[field.name]) input.autocomplete = AUTOCOMPLETE[field.name];
  if (PLACEHOLDERS[field.kind]) input.placeholder = PLACEHOLDERS[field.kind];
  if (field.kind === 'postcode') input.autocapitalize = 'characters';
  if (field.kind === 'email' || field.kind === 'url') { input.autocapitalize = 'none'; input.spellcheck = false; }

  const label = node('label', field.kind === 'checkbox' ? 'check' : '');
  label.htmlFor = id;
  const text = field.label + (field.required ? ' *' : '');
  if (field.kind === 'checkbox') {
    label.append(input, node('span', '', text));
    box.append(label, msg);
    return box;
  }
  label.textContent = text;
  box.append(label, input, msg);

  // Long answers get a live character count; email gets typo suggestions.
  if (field.kind === 'longtext') {
    const meta = node('div', 'field-meta');
    if (baseField.min) meta.append(node('span', 'min-hint', `At least ${baseField.min} characters`));
    const counter = node('span', 'counter', `0 / ${field.max.toLocaleString('en-GB')}`);
    counter.setAttribute('aria-hidden', 'true');
    meta.append(counter);
    box.append(meta);
  }
  if (field.kind === 'money' && field.presets) {
    const presets = node('div', 'presets');
    presets.setAttribute('role', 'group');
    presets.setAttribute('aria-label', 'Suggested amounts');
    field.presets.forEach((amount) => {
      const chip = node('button', 'preset', `£${amount}`);
      chip.type = 'button';
      chip.addEventListener('click', () => {
        input.value = String(amount);
        presets.querySelectorAll('.preset').forEach((c) => c.classList.toggle('on', c === chip));
        touched.add(field.name);
        evaluate(field.name);
      });
      presets.append(chip);
    });
    input.addEventListener('input', () => {
      presets.querySelectorAll('.preset').forEach((c) => c.classList.toggle('on', c.textContent === `£${input.value.trim()}`));
    });
    box.insertBefore(presets, input);
  }
  if (field.kind === 'email') {
    const suggest = node('div', 'suggest');
    suggest.hidden = true;
    suggest.setAttribute('aria-live', 'polite');
    box.append(suggest);
  }
  return box;
}

// Paints one field: 'invalid' with a message, 'valid' (green tick) or neutral.
function paint(name, state, message = '') {
  const box = boxOf(name);
  if (!box) return;
  const input = form.elements[name];
  const msg = box.querySelector('.field-msg');
  box.classList.toggle('is-invalid', state === 'invalid');
  box.classList.toggle('is-valid', state === 'valid' && fieldOf(name).kind !== 'checkbox');
  msg.classList.toggle('show', state === 'invalid');
  if (state === 'invalid') {
    msg.textContent = message;
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
    // Let the collapse animation finish before the text disappears.
    setTimeout(() => { if (!msg.classList.contains('show')) msg.textContent = ''; }, 250);
  }
}

// Checks one field and paints it. Errors only show once the field is touched;
// "valid" shows as soon as a non-empty answer passes.
function evaluate(name) {
  const field = fieldOf(name);
  if (!field || !isActive(field, readValues())) return true;
  const value = valueOf(field);
  const { error } = checkField(field, value);
  const empty = field.kind === 'checkbox' ? !value : String(value).trim() === '';
  if (error) paint(name, touched.has(name) ? 'invalid' : 'neutral', error);
  else paint(name, empty ? 'neutral' : 'valid');
  if (form.querySelector('.form-note').textContent) updateNote();
  return !error;
}

function updateNote() {
  const count = form.querySelectorAll('.field.is-invalid').length;
  form.querySelector('.form-note').textContent = count
    ? `Please check the ${count === 1 ? 'highlighted field' : `${count} highlighted fields`}.`
    : '';
}

function updateCounter(name) {
  const field = fieldOf(name);
  const counter = boxOf(name)?.querySelector('.counter');
  if (!counter) return;
  const n = form.elements[name].value.trim().length;
  counter.textContent = `${n.toLocaleString('en-GB')} / ${field.max.toLocaleString('en-GB')}`;
  counter.classList.toggle('ok', n >= (field.min || 1) && n <= field.max);
  counter.classList.toggle('over', n > field.max);
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

function updateSuggestion(name) {
  const box = boxOf(name);
  const suggest = box?.querySelector('.suggest');
  if (!suggest) return;
  const value = form.elements[name].value.trim();
  const at = value.lastIndexOf('@');
  const domain = at > 0 ? value.slice(at + 1).toLowerCase() : '';
  let best = null;
  if (domain.includes('.') && !DOMAINS.includes(domain)) {
    for (const d of DOMAINS) {
      const dist = levenshtein(domain, d);
      if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
    }
  }
  suggest.hidden = !best;
  suggest.replaceChildren();
  if (!best) return;
  const fixed = `${value.slice(0, at + 1)}${best.d}`;
  const button = node('button', '', fixed);
  button.type = 'button';
  button.addEventListener('click', () => {
    form.elements[name].value = fixed;
    suggest.hidden = true;
    touched.add(name);
    evaluate(name);
    form.elements[name].focus();
  });
  suggest.append('Did you mean ', button, '?');
}

function readValues() {
  const data = {};
  for (const field of config.fields) data[field.name] = valueOf(field);
  return data;
}

// Marks every field, nudges the wrong ones and moves to the first.
function showErrors(errors) {
  config.fields.forEach((f) => {
    if (!isActive(f, readValues())) return;
    touched.add(f.name);
    if (errors[f.name]) paint(f.name, 'invalid', errors[f.name]);
    else evaluate(f.name);
  });
  updateNote();
  const first = config.fields.find((f) => errors[f.name]);
  if (!first) return;
  form.querySelectorAll('.field.is-invalid').forEach((box) => {
    box.classList.remove('nudge');
    void box.offsetWidth; // restart the animation
    box.classList.add('nudge');
  });
  const input = form.elements[first.name];
  boxOf(first.name).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  input.focus({ preventScroll: true });
}

// Switches the support form between donating and other offers: the amount
// field appears, and fields with a donation version (amount, offer) take
// that version's label, required marker and length hint.
function syncAmount() {
  const raw = readValues();
  config.fields.filter((f) => f.payment).forEach((base) => {
    const f = paymentField(base, payments, raw);
    const box = boxOf(f.name);
    const input = form.elements[f.name];
    box.querySelector('label').textContent = f.label + (f.required ? ' *' : '');
    if (f.required) input.setAttribute('aria-required', 'true');
    else input.removeAttribute('aria-required');
    const hint = box.querySelector('.min-hint');
    if (hint) hint.hidden = !f.min;
    if (f.kind === 'longtext') updateCounter(f.name);
    if (touched.has(f.name) || box.classList.contains('is-invalid')) evaluate(f.name);
  });
  const field = config.fields.find((f) => f.showIf);
  if (!field) return;
  const show = isActive(field, readValues());
  boxOf(field.name).hidden = !show;
  form.elements[field.name].disabled = !show;
  if (!show) { touched.delete(field.name); paint(field.name, 'neutral'); }
}

function openFlow(formKey, trigger) {
  opener = trigger;
  key = formKey;
  config = FORMS[formKey];
  touched = new Set();
  sending = false;
  document.querySelector('#form-title').textContent = config.title;
  document.querySelector('#form-intro').textContent = (payments && config.introPayments) || config.intro;
  body.replaceChildren();

  form = node('form');
  form.noValidate = true;
  const fields = node('div', 'fields');
  config.fields.forEach((f) => fields.append(buildField(f)));

  // Spam trap: hidden from people, filled in by simple bots.
  const trap = node('div', 'trap');
  trap.setAttribute('aria-hidden', 'true');
  const trapLabel = node('label', '', 'Leave this empty ');
  const trapInput = document.createElement('input');
  Object.assign(trapInput, { type: 'text', name: 'nickname', tabIndex: -1, autocomplete: 'off' });
  trapLabel.append(trapInput);
  trap.append(trapLabel);

  const privacy = node('p', 'privacy', 'Optional updates are separate from your request. We use your details to handle this request. Read our ');
  const privacyLink = node('a', '', 'privacy policy');
  Object.assign(privacyLink, { href: PRIVACY_URL, target: '_blank', rel: 'noopener noreferrer' });
  privacy.append(privacyLink, '.');

  const note = node('p', 'form-note');
  note.setAttribute('role', 'alert');
  const actions = node('div', 'actions');
  const reviewBtn = node('button', 'btn', 'Review your details →');
  reviewBtn.type = 'submit';
  actions.append(reviewBtn);
  form.append(fields, trap, privacy, note, actions);
  body.append(form);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { errors } = validate(key, readValues(), { payments });
    if (Object.keys(errors).length) showErrors(errors);
    else showReview();
  });
  form.addEventListener('input', (event) => {
    const { name } = event.target;
    if (!name || name === 'nickname') return;
    const field = fieldOf(name);
    if (field?.kind === 'postcode') {
      // Upper case as they type, keeping the cursor where it was.
      const input = event.target;
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(pos, pos);
    }
    if (field?.kind === 'longtext') updateCounter(name);
    if (field?.kind === 'email') updateSuggestion(name);
    evaluate(name);
  });
  form.addEventListener('focusout', (event) => {
    const t = event.target;
    if (!t.name || t.name === 'nickname' || t.type === 'checkbox') return;
    if (String(t.value).trim() !== '') touched.add(t.name);
    evaluate(t.name);
  });
  form.addEventListener('change', (event) => {
    const t = event.target;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') {
      touched.add(t.name);
      evaluate(t.name);
    }
  });
  if (config.fields.some((f) => f.showIf)) {
    form.elements.type.addEventListener('change', syncAmount);
    syncAmount();
  }

  modal.showModal();
  form.querySelector('input:not([tabindex="-1"]),select,textarea').focus();
}

function display(field, value) {
  if (field.kind === 'checkbox') return value ? 'Yes' : 'No';
  if (value === '' || value == null) return 'Not provided';
  if (field.kind === 'money') return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (field.kind === 'int') return value.toLocaleString('en-GB');
  return String(value);
}

function showReview() {
  const { values } = validate(key, readValues(), { payments });
  form.hidden = true;
  const review = node('div', 'review');
  const heading = node('h3', '', 'Review your details');
  heading.tabIndex = -1;
  const dl = node('dl');
  config.fields.forEach((base) => {
    const field = paymentField(base, payments, values);
    if (!(field.name in values)) return;
    dl.append(node('dt', '', field.label), node('dd', '', display(field, values[field.name])));
  });
  const donating = isDonation(key, values, payments);
  const payNote = node('p', 'pay-note', 'You’ll donate on a secure page run by Stripe. We never see your card details.');
  payNote.hidden = !donating;
  const alert = node('div', 'form-alert');
  alert.setAttribute('role', 'alert');
  const actions = node('div', 'actions');
  const back = node('button', 'btn outline', 'Edit details');
  const confirm = node('button', 'btn', donating ? 'Continue to secure payment →' : key === 'book' ? 'Email me the book' : 'Confirm and send');
  back.type = 'button';
  confirm.type = 'button';
  actions.append(back, confirm);
  review.append(heading, dl, payNote, alert, actions);
  body.append(review);
  heading.focus();

  back.onclick = () => {
    review.remove();
    form.hidden = false;
    form.querySelector('input:not([tabindex="-1"]),select,textarea').focus();
  };
  confirm.onclick = () => submit({ review, alert, back, confirm });
}

async function submit({ review, alert, back, confirm }) {
  if (sending) return;
  sending = true;
  const label = confirm.textContent;
  confirm.disabled = true;
  back.disabled = true;
  confirm.textContent = 'Sending…';
  alert.textContent = '';

  let res;
  let data = {};
  try {
    res = await fetch('/api/kawthar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ form: key, data: readValues(), source, nickname: form.elements.nickname.value }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    res = null;
  }
  sending = false;

  if (res?.ok && data.ok && data.checkoutUrl) {
    confirm.textContent = 'Opening secure payment…';
    location.assign(data.checkoutUrl);
    return;
  }
  if (res?.ok && data.ok) return showSuccess(data.message);

  confirm.disabled = false;
  back.disabled = false;
  confirm.textContent = label;
  if (res?.status === 422 && data.errors) {
    review.remove();
    form.hidden = false;
    showErrors(data.errors);
    return;
  }
  alert.textContent = data.message || 'We couldn’t send your details. Please check your connection and try again. Nothing you entered has been lost.';
  alert.tabIndex = -1;
  alert.focus();
}

function showSuccess(message) {
  body.replaceChildren();
  const success = node('div', 'success');
  const h = node('h3', '', HEADINGS[key]);
  h.tabIndex = -1;
  const done = node('button', 'btn', 'Return to the campaign');
  done.type = 'button';
  done.onclick = () => modal.close();
  success.append(node('div', 'tick', '✓'), h, node('p', '', message || config.success), done);
  body.append(success);
  h.focus();
}

document.querySelectorAll('[data-open]').forEach((btn) => btn.addEventListener('click', async () => {
  // The config check is quick; wait for it (at most 1.5s) so the support
  // form shows the right amount field.
  await Promise.race([paymentsReady, new Promise((r) => setTimeout(r, 1500))]);
  openFlow(btn.dataset.open, btn);
}));

paymentsReady.then(() => {
  if (!payments) return;
  document.querySelectorAll('[data-payments-text]').forEach((el) => { el.textContent = el.dataset.paymentsText; });
});

// Back from Stripe Checkout: ?donation=success&session_id=… or ?donation=cancelled.
// This screen only reports; the donation is recorded by the Stripe webhook.
function showDonationReturn() {
  const params = new URLSearchParams(location.search);
  const outcome = params.get('donation');
  if (outcome !== 'success' && outcome !== 'cancelled') return;
  const sessionId = params.get('session_id');
  params.delete('donation');
  params.delete('session_id');
  history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);

  opener = null;
  form = null;
  config = null;
  document.querySelector('#form-title').textContent = outcome === 'success' ? 'Your donation' : 'Payment cancelled';
  document.querySelector('#form-intro').textContent = '';
  body.replaceChildren();
  const box = node('div', 'success');
  const h = node('h3', '', outcome === 'success' ? 'Thank you for your donation' : 'No payment was taken');
  h.tabIndex = -1;
  const text = node('p', '', outcome === 'success'
    ? 'We’re confirming your payment with Stripe. A receipt is on its way to your inbox.'
    : 'You left the secure payment page before donating, so nothing has been charged. You can try again whenever you’re ready.');
  const actions = node('div', 'actions');
  const done = node('button', 'btn', 'Return to the campaign');
  done.type = 'button';
  done.onclick = () => modal.close();
  actions.append(done);
  if (outcome === 'cancelled') {
    const retry = node('button', 'btn outline', 'Try again');
    retry.type = 'button';
    retry.onclick = () => { modal.close(); setTimeout(() => document.querySelector('[data-open="support"]').click(), 0); };
    actions.append(retry);
  }
  box.append(node('div', 'tick', outcome === 'success' ? '✓' : '↺'), h, text, actions);
  body.append(box);
  modal.showModal();
  h.focus();

  if (outcome === 'success' && sessionId) {
    fetch(`/api/kawthar?session_id=${encodeURIComponent(sessionId)}`, { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ok) return;
        text.textContent = d.paid
          ? `Your donation of ${d.amount} has been received. A receipt is on its way to your inbox. Thank you for helping Kawthar reach further.`
          : `Your donation of ${d.amount} is being processed. We’ll email your receipt as soon as it’s confirmed.`;
      })
      .catch(() => {});
  }
}
showDonationReturn();
document.querySelector('.close').onclick = () => modal.close();
modal.addEventListener('click', (event) => {
  if (event.target !== modal) return;
  const r = modal.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) modal.close();
});
modal.addEventListener('close', () => {
  // "close" fires asynchronously; ignore it if another form has already opened.
  if (modal.open) return;
  body.replaceChildren();
  form = null;
  config = null;
  if (opener) opener.focus();
});
