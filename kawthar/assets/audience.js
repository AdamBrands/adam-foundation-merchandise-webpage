// Kawthar audience pages (/kawthar/donate, /masjids, /bottle, /corporate).
//
// The forms are the comms team's design markup. This script gives them the
// same behaviour as the /kawthar forms (kawthar/assets/app.js): the shared
// rules in forms.js, errors once a field has been left (green as soon as it is
// right), an error summary, a review step, then /api/kawthar. The Donate page
// goes on to Stripe Checkout while online payments are on.
import { FORMS, validate, checkField, isDonation, displayValue } from './forms.js';
import { suggestEmail, sourceFrom } from './form-ui.js';

// data-kind in the design markup → form key in forms.js.
const KINDS = { mosque: 'masjid', partner: 'partner', donation: 'donation', book: 'bottle' };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const slug = location.pathname.replace(/\/+$/, '').split('/').pop();
const source = sourceFrom(location.search, /^[a-z]+$/.test(slug) ? `kawthar-${slug}` : 'kawthar');
const currency = (value) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number(value));

function node(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// Online donations are on when the server has Stripe keys (GET /api/kawthar).
// Only the Donate page needs to know.
let payments = false;
const paymentsReady = document.getElementById('df-donation-form')
  ? fetch('/api/kawthar', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => { payments = Boolean(d.payments); })
    .catch(() => {})
  : Promise.resolve();

/* ---------- Dialogs (from the design) ---------- */

const dialogs = [];
function registerDialog(id, titleId, closeSelector) {
  const element = document.getElementById(id);
  if (!element) return null;
  let launcher = null;
  const close = () => { if (element.open) element.close(); };
  const open = (button) => {
    if (element.open) return;
    dialogs.forEach((d) => d.close());
    launcher = button;
    element.showModal();
    document.body.classList.add('modal-open');
    document.getElementById(titleId).focus({ preventScroll: true });
  };
  element.querySelector(closeSelector).addEventListener('click', close);
  element.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  element.addEventListener('click', (event) => {
    if (event.target !== element) return;
    const r = element.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) close();
  });
  element.addEventListener('close', () => {
    if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open');
    if (launcher?.isConnected && !launcher.closest('[hidden]')) launcher.focus({ preventScroll: true });
  });
  const controller = { element, open, close };
  dialogs.push(controller);
  return controller;
}

/* ---------- Form behaviour ---------- */

// Wires one design form. `extra` supplies fields that live outside the form:
// the Donate page's amount is chosen on the page, before the details dialog.
function enhance(form, { extra = {}, onShowErrors } = {}) {
  const key = KINDS[form.dataset.kind];
  const config = FORMS[key];
  const result = document.getElementById(form.dataset.result);
  const resultText = result.querySelector('[data-result-text]');
  const resultEdit = result.querySelector('[data-edit-form]');
  const touched = new Set();
  let sending = false;
  let review = null;
  let done = false;

  form.noValidate = true;
  const inputOf = (name) => extra[name]?.input || form.elements[name];
  const boxOf = (name) => extra[name]?.box || form.querySelector(`[data-field="${name}"]`);
  const fieldOf = (name) => config.fields.find((f) => f.name === name);
  const valueOf = (field) => {
    const input = inputOf(field.name);
    if (!input) return '';
    return field.kind === 'checkbox' ? input.checked : input.value;
  };
  const readValues = () => Object.fromEntries(config.fields.map((f) => [f.name, valueOf(f)]));

  // Message, counter and suggestion slots for each field the person can see.
  for (const field of config.fields) {
    const input = inputOf(field.name);
    if (!input) {
      console.error(`Kawthar ${key} form: no input named "${field.name}"`);
      continue;
    }
    if (input.type === 'hidden') continue;
    let box = boxOf(field.name) || input.closest('.field');
    if (field.kind === 'checkbox') {
      const label = input.closest('label');
      box = node('div', 'check-field');
      label.replaceWith(box);
      box.append(label);
      if (field.name === 'updates' && label.textContent.replace(/\s+/g, ' ').trim() !== config.updatesLabel) {
        console.warn(`Kawthar ${key} form: the checkbox wording differs from updatesLabel in forms.js`);
      }
    }
    if (!box) continue;
    box.dataset.field = field.name;
    const msg = node('span', 'field-msg');
    msg.id = `msg-${form.id}-${field.name}`;
    box.append(msg);
    input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), msg.id].filter(Boolean).join(' '));
    if (field.required) input.setAttribute('aria-required', 'true');
    if (field.kind === 'email') {
      input.autocapitalize = 'none';
      input.spellcheck = false;
      const suggest = node('div', 'suggest');
      suggest.hidden = true;
      suggest.setAttribute('aria-live', 'polite');
      box.append(suggest);
    }
    if (field.kind === 'postcode') input.autocapitalize = 'characters';
    if (field.kind === 'longtext') {
      const meta = node('div', 'field-meta');
      if (field.min) meta.append(node('span', 'min-hint', `At least ${field.min} characters`));
      const counter = node('span', 'counter', `0 / ${field.max.toLocaleString('en-GB')}`);
      counter.setAttribute('aria-hidden', 'true');
      meta.append(counter);
      box.insertBefore(meta, msg);
    }
  }

  // Spam trap: hidden from people, filled in by simple bots.
  const trap = node('div', 'trap');
  trap.setAttribute('aria-hidden', 'true');
  const trapLabel = node('label', '', 'Leave this empty ');
  const trapInput = document.createElement('input');
  Object.assign(trapInput, { type: 'text', name: 'nickname', tabIndex: -1, autocomplete: 'off' });
  trapLabel.append(trapInput);
  trap.append(trapLabel);
  const note = node('p', 'form-note');
  note.setAttribute('role', 'alert');
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.before(trap, note);

  function paint(name, state, message = '') {
    const box = boxOf(name);
    const input = inputOf(name);
    if (!box || !input) return;
    const msg = box.querySelector('.field-msg');
    box.classList.toggle('is-invalid', state === 'invalid');
    box.classList.toggle('is-valid', state === 'valid' && fieldOf(name).kind !== 'checkbox');
    msg.classList.toggle('show', state === 'invalid');
    if (state === 'invalid') {
      msg.textContent = message;
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
      setTimeout(() => { if (!msg.classList.contains('show')) msg.textContent = ''; }, 250);
    }
  }

  function updateNote() {
    const count = form.querySelectorAll('[data-field].is-invalid').length;
    note.textContent = count ? `Please check the ${count === 1 ? 'highlighted field' : `${count} highlighted fields`}.` : '';
  }

  function evaluate(name) {
    const field = fieldOf(name);
    if (!field) return true;
    const value = valueOf(field);
    const { error } = checkField(field, value);
    const empty = field.kind === 'checkbox' ? !value : String(value).trim() === '';
    if (error) paint(name, touched.has(name) ? 'invalid' : 'neutral', error);
    else paint(name, empty ? 'neutral' : 'valid');
    if (note.textContent) updateNote();
    return !error;
  }

  function updateCounter(name) {
    const field = fieldOf(name);
    const counter = boxOf(name)?.querySelector('.counter');
    if (!counter) return;
    const n = inputOf(name).value.trim().length;
    counter.textContent = `${n.toLocaleString('en-GB')} / ${field.max.toLocaleString('en-GB')}`;
    counter.classList.toggle('ok', n >= (field.min || 1) && n <= field.max);
    counter.classList.toggle('over', n > field.max);
  }

  function updateSuggestion(name) {
    const suggest = boxOf(name)?.querySelector('.suggest');
    if (!suggest) return;
    const fixed = suggestEmail(inputOf(name).value);
    suggest.hidden = !fixed;
    suggest.replaceChildren();
    if (!fixed) return;
    const button = node('button', '', fixed);
    button.type = 'button';
    button.addEventListener('click', () => {
      inputOf(name).value = fixed;
      suggest.hidden = true;
      touched.add(name);
      evaluate(name);
      inputOf(name).focus();
    });
    suggest.append('Did you mean ', button, '?');
  }

  // Marks every field, nudges the wrong ones and moves to the first.
  function showErrors(errors) {
    config.fields.forEach((f) => {
      touched.add(f.name);
      if (errors[f.name]) paint(f.name, 'invalid', errors[f.name]);
      else evaluate(f.name);
    });
    if (onShowErrors && onShowErrors(errors)) return;
    updateNote();
    const first = config.fields.find((f) => errors[f.name] && form.contains(boxOf(f.name)));
    if (!first) return;
    form.querySelectorAll('[data-field].is-invalid').forEach((box) => {
      box.classList.remove('nudge');
      void box.offsetWidth; // restart the animation
      box.classList.add('nudge');
    });
    boxOf(first.name).scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    inputOf(first.name).focus({ preventScroll: true });
  }

  function onInput(event) {
    const { name } = event.target;
    const field = name && fieldOf(name);
    if (!field) return;
    if (field.kind === 'postcode') {
      // Upper case as they type, keeping the cursor where it was.
      const input = event.target;
      const pos = input.selectionStart;
      input.value = input.value.toUpperCase();
      input.setSelectionRange(pos, pos);
    }
    if (field.kind === 'longtext') updateCounter(name);
    if (field.kind === 'email') updateSuggestion(name);
    evaluate(name);
  }
  function onLeave(event) {
    const t = event.target;
    if (!t.name || !fieldOf(t.name) || t.type === 'checkbox') return;
    if (String(t.value).trim() !== '') touched.add(t.name);
    evaluate(t.name);
  }
  function onChange(event) {
    const t = event.target;
    if (!fieldOf(t.name)) return;
    if (t.type === 'checkbox' || t.tagName === 'SELECT') {
      touched.add(t.name);
      evaluate(t.name);
    }
  }
  for (const target of [form, ...Object.values(extra).map((x) => x.box)]) {
    target.addEventListener('input', onInput);
    target.addEventListener('focusout', onLeave);
    target.addEventListener('change', onChange);
  }

  function firstInput() {
    return [...form.querySelectorAll('input,select,textarea')].find((el) => el.type !== 'hidden' && el.tabIndex !== -1);
  }

  function showReview() {
    const { values } = validate(key, readValues(), { payments });
    const donating = isDonation(key, values, payments);
    review = node('div', 'review');
    const heading = node('h3', '', 'Review your details');
    heading.tabIndex = -1;
    const dl = node('dl');
    config.fields.forEach((field) => {
      if (!(field.name in values) || (values[field.name] === '' && field.name === 'partnership_path')) return;
      dl.append(node('dt', '', field.label.replace(/ \(optional\)$/i, '')), node('dd', '', displayValue(field, values[field.name])));
    });
    const payNote = node('p', 'pay-note', 'You’ll donate on a secure page run by Stripe. We never see your card details.');
    payNote.hidden = !donating;
    const alert = node('div', 'form-alert');
    alert.setAttribute('role', 'alert');
    const actions = node('div', 'review-actions');
    const back = node('button', 'button outline', 'Edit details');
    const confirmLabel = donating ? 'Continue to secure payment'
      : key === 'bottle' ? 'Email me the book'
        : key === 'donation' ? 'Send my pledge'
          : 'Confirm and send';
    const confirm = node('button', 'button', confirmLabel);
    back.type = 'button';
    confirm.type = 'button';
    actions.append(back, confirm);
    review.append(heading, dl, payNote, alert, actions);
    form.hidden = true;
    form.after(review);
    heading.focus({ preventScroll: true });
    review.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });

    back.onclick = () => {
      review.remove();
      review = null;
      form.hidden = false;
      firstInput()?.focus();
    };
    confirm.onclick = () => submit({ alert, back, confirm });
  }

  async function submit({ alert, back, confirm }) {
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
        body: JSON.stringify({ form: key, data: readValues(), source, nickname: trapInput.value }),
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
    if (res?.ok && data.ok) {
      showResult(config.heading, data.message || config.success);
      return;
    }
    confirm.disabled = false;
    back.disabled = false;
    confirm.textContent = label;
    if (res?.status === 422 && data.errors) {
      review.remove();
      review = null;
      form.hidden = false;
      showErrors(data.errors);
      return;
    }
    alert.textContent = data.message || 'We couldn’t send your details. Please check your connection and try again. Nothing you entered has been lost.';
    alert.tabIndex = -1;
    alert.focus();
  }

  // The design's result panel, used for the outcome. In a dialog its button
  // closes the dialog; on the page (the book form) it is hidden.
  function showResult(heading, message, { retry = null } = {}) {
    review?.remove();
    review = null;
    form.hidden = true;
    done = true;
    result.querySelector('h3').textContent = heading;
    resultText.textContent = message;
    const summary = result.querySelector('[data-summary]');
    if (summary) summary.hidden = true;
    const dialog = form.closest('dialog');
    if (resultEdit) {
      resultEdit.hidden = !dialog && !retry;
      resultEdit.textContent = retry ? 'Try again' : 'Close';
      resultEdit.onclick = retry || (() => dialog?.close());
    }
    result.hidden = false;
    result.querySelector('h3').focus({ preventScroll: true });
    result.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
  }

  function reset() {
    form.reset();
    touched.clear();
    config.fields.forEach((f) => { if (!extra[f.name]) paint(f.name, 'neutral'); });
    form.querySelectorAll('.counter').forEach((c) => c.classList.remove('ok', 'over'));
    note.textContent = '';
    review?.remove();
    review = null;
    result.hidden = true;
    form.hidden = false;
    done = false;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const { errors } = validate(key, readValues(), { payments });
    if (Object.keys(errors).length) showErrors(errors);
    else showReview();
  });

  return {
    key,
    config,
    form,
    evaluate,
    paint,
    touched,
    showResult,
    // Reopening a dialog after a finished submission starts a fresh form.
    prepare() { if (done) reset(); },
  };
}

/* ---------- Masjids ---------- */

const masjidDialog = registerDialog('masjid-dialog', 'application-title', '[data-close-application]');
const masjidForm = document.getElementById('mosque-form');
if (masjidDialog && masjidForm) {
  const masjid = enhance(masjidForm);
  document.querySelectorAll('[data-open-application]').forEach((button) => button.addEventListener('click', () => {
    masjid.prepare();
    masjidDialog.open(button);
  }));
}

/* ---------- Corporate ---------- */

const partnerDialog = registerDialog('partner-dialog', 'partnership-title', '[data-close-partner]');
const partnerForm = document.getElementById('partner-form');
if (partnerDialog && partnerForm) {
  const partner = enhance(partnerForm);
  let lastSuggestedMessage = '';
  document.querySelectorAll('[data-open-partner]').forEach((button) => button.addEventListener('click', () => {
    partner.prepare();
    const interest = button.dataset.partnerInterest || '';
    const suggested = button.dataset.partnerMessage || '';
    const { elements } = partnerForm;
    // As in the design: each button sets its own interest, and the general
    // "Become a Partner" buttons clear it so the person chooses.
    elements.interest.value = interest;
    partner.touched.delete('interest');
    elements.partnership_path.value = button.dataset.partnerPath || '';
    if (!elements.message.value.trim() || elements.message.value === lastSuggestedMessage) elements.message.value = suggested;
    lastSuggestedMessage = suggested;
    elements.message.dispatchEvent(new Event('input', { bubbles: true }));
    partner.evaluate('interest');
    partnerDialog.element.querySelector('[data-partner-context]').textContent = button.dataset.partnerLabel || 'General partnership enquiry';
    partnerDialog.open(button);
  }));
}

/* ---------- Bottle QR (adhkar book) ---------- */

const bookForm = document.getElementById('book-form');
if (bookForm) enhance(bookForm);

/* ---------- Donate ---------- */

const donorDialog = registerDialog('donor-dialog', 'donor-title', '[data-close-donation]');
const amountForm = document.getElementById('donation-amount-form');
const detailsForm = document.getElementById('df-donation-form');
if (donorDialog && amountForm && detailsForm) {
  amountForm.noValidate = true;
  const amountInput = amountForm.elements.amount;
  const amountBox = amountForm.querySelector('fieldset') || amountForm;
  const selection = donorDialog.element.querySelector('.donation-selection');
  const intro = document.getElementById('donor-intro');

  const donation = enhance(detailsForm, {
    extra: { amount: { input: amountInput, box: amountBox } },
    // A problem with the amount is fixed on the page, not in the dialog.
    onShowErrors(errors) {
      if (!errors.amount) return false;
      donorDialog.close();
      amountBox.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      amountInput.focus({ preventScroll: true });
      return true;
    },
  });
  const amountField = donation.config.fields.find((f) => f.name === 'amount');

  const syncPresets = () => amountForm.querySelectorAll('[data-amount]').forEach((b) => {
    b.setAttribute('aria-pressed', String(amountInput.value !== '' && Number(b.dataset.amount) === Number(amountInput.value)));
  });
  amountForm.querySelectorAll('[data-amount]').forEach((button) => button.addEventListener('click', () => {
    amountInput.value = button.dataset.amount;
    donation.touched.add('amount');
    syncPresets();
    donation.evaluate('amount');
  }));
  amountInput.addEventListener('input', syncPresets);

  amountForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const { error, value } = checkField(amountField, amountInput.value);
    if (error) {
      donation.touched.add('amount');
      donation.paint('amount', 'invalid', error);
      amountInput.focus();
      return;
    }
    donation.prepare();
    detailsForm.elements.amount.value = String(value);
    donorDialog.element.querySelector('[data-donation-total]').textContent = currency(value);
    if (selection) selection.hidden = false;
    if (intro) intro.hidden = false;
    donorDialog.open(amountForm.querySelector('button[type="submit"]'));
  });
  donorDialog.element.querySelector('[data-change-amount]').addEventListener('click', () => {
    donorDialog.close();
    amountInput.focus({ preventScroll: true });
  });

  paymentsReady.then(() => {
    if (payments) return;
    document.querySelectorAll('[data-payments-off-text]').forEach((el) => { el.textContent = el.dataset.paymentsOffText; });
  });

  // Back from Stripe Checkout: ?donation=success&session_id=… or ?donation=cancelled.
  // This only reports; the donation is recorded by the Stripe webhook.
  const params = new URLSearchParams(location.search);
  const outcome = params.get('donation');
  if (outcome === 'success' || outcome === 'cancelled') {
    const sessionId = params.get('session_id');
    params.delete('donation');
    params.delete('session_id');
    history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`);
    if (selection) selection.hidden = true;
    if (intro) intro.hidden = true;
    donorDialog.open(null);
    if (outcome === 'success') {
      donation.showResult('Thank you for your donation', 'We’re confirming your payment with Stripe. A receipt is on its way to your inbox.');
      if (sessionId) {
        fetch(`/api/kawthar?session_id=${encodeURIComponent(sessionId)}`, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (!d?.ok) return;
            const text = document.querySelector('#df-donation-result [data-result-text]');
            text.textContent = d.paid
              ? `Your donation of ${d.amount} has been received. A receipt is on its way to your inbox. Thank you for helping Kawthar reach further.`
              : `Your donation of ${d.amount} is being processed. We’ll email your receipt as soon as it’s confirmed.`;
          })
          .catch(() => {});
      }
    } else {
      donation.showResult('No payment was taken', 'You left the secure payment page before donating, so nothing has been charged. You can try again whenever you’re ready.', {
        retry: () => { donorDialog.close(); amountInput.focus({ preventScroll: true }); },
      });
    }
  }
}

// Buttons start disabled in the markup, so nothing is submitted before this
// script has loaded.
document.querySelectorAll('[data-live-submit],[data-live-modal]').forEach((button) => { button.disabled = false; });
