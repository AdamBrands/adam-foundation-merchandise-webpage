import { allowedOrigin, allowedReturnPage, corsHeaders } from './_lib/cors.js';
import { DonationError, donationStatus, prepareDonation, startDonation } from './_lib/donation.js';
import { cleanCode } from './_lib/request.js';
import { paymentsEnabled, testMode } from './_lib/stripe.js';
import { BOTTLE, DONATION_TYPE, FORMS, GIFT_AID, consentFor, validate } from '../kawthar/assets/forms.js';

// Donations API for the Donate page on adamfoundation.com (WordPress), which
// takes donations through connect so Stripe, Gift Aid, receipts and /report
// stay in one place. The developer's guide is docs/donations-api.md.
//
//   GET  /api/donations                   settings for the page (amounts, fields, wording)
//   POST /api/donations                   stores the donation, returns a Stripe Checkout URL and its session id
//   GET  /api/donations?session_id=cs_…   the donation's status after Stripe Checkout
//
// Only the browser origins in api/_lib/cors.js may call it. Donations are the
// same kawthar_submissions rows (form "donation") as connect's own Donate page
// (api/kawthar.js), so api/stripe-webhook.js confirms them and sends the
// receipt and team notification.

const MAX_BODY = 32 * 1024;
const DEFAULT_SOURCE = 'website-donate';

// The request's Origin when it may call the API, null when it sent none
// (same-site or server-to-server), or false when it is not allowed.
function originOf(request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  return allowedOrigin(origin, new URL(request.url).hostname) || false;
}

const respond = (origin, status, body) => Response.json(
  { ok: status < 400, ...body },
  { status, headers: corsHeaders(origin || null) },
);

const forbidden = () => respond(null, 403, {
  code: 'origin_not_allowed',
  message: 'This website isn’t allowed to take donations through Adam Foundation Connect.',
});

export function OPTIONS(request) {
  const origin = originOf(request);
  if (origin === false) return forbidden();
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request) {
  const origin = originOf(request);
  if (origin === false) return forbidden();

  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (sessionId) {
    const status = await donationStatus(sessionId);
    if (!status) return respond(origin, 404, { code: 'not_found', message: 'We couldn’t find that donation.' });
    return respond(origin, 200, status);
  }

  const amount = FORMS.donation.fields.find((field) => field.name === 'amount');
  const consent = consentFor('donation');
  return respond(origin, 200, {
    payments: paymentsEnabled(),
    testMode: paymentsEnabled() && testMode(),
    currency: 'GBP',
    amount: { min: amount.min, max: amount.max },
    bottles: BOTTLE,
    donationType: DONATION_TYPE,
    fields: FORMS.donation.fields.map(({ name, label, kind, required, min, max, giftAid }) => ({
      name, label, kind, required, ...(min != null && { min }), ...(max != null && { max }), ...(giftAid && { giftAidOnly: true }),
    })),
    updates: { text: consent.text, version: consent.version },
    giftAid: {
      version: GIFT_AID.version,
      scope: GIFT_AID.scope,
      declaration: GIFT_AID.declaration('{amount}'),
      ratePercent: 25,
    },
  });
}

export async function POST(request) {
  const origin = originOf(request);
  if (origin === false) return forbidden();
  const reply = (status, body) => respond(origin, status, body);

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
    return reply(413, { code: 'too_large', message: 'That’s too much text to send. Please shorten your answers and try again.' });
  }
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) {
      return reply(413, { code: 'too_large', message: 'That’s too much text to send. Please shorten your answers and try again.' });
    }
    payload = JSON.parse(raw);
    if (!payload || typeof payload !== 'object') throw new Error('not an object');
  } catch {
    return reply(400, { code: 'bad_request', message: 'Something went wrong. Please try again.' });
  }

  // Honeypot: a hidden field people never fill in. Bots get a plain "thank
  // you" with no payment page, and nothing is stored.
  if (payload.nickname) return reply(200, { message: 'Thank you.' });

  if (!paymentsEnabled()) {
    return reply(503, { code: 'payments_unavailable', message: 'Online donations aren’t open just now. Please try again later.' });
  }

  const returnTo = allowedReturnPage(payload.returnUrl, new URL(request.url).hostname);
  if (!returnTo) {
    return reply(422, {
      code: 'invalid_return_url',
      message: 'Something went wrong. Please refresh the page and try again.',
      errors: { returnUrl: 'returnUrl must be the full address of the donate page, on a website allowed to use this API' },
    });
  }

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const { values, errors } = validate('donation', data);
  if (Object.keys(errors).length) {
    return reply(422, { code: 'invalid', message: 'Please correct the highlighted answers.', errors });
  }
  prepareDonation(values);

  try {
    const { sessionId, checkoutUrl } = await startDonation({
      request,
      values,
      source: cleanCode(payload.source) || DEFAULT_SOURCE,
      returnTo,
    });
    // sessionId lets adamfoundation.com match its own copy of the donation to
    // the payment: Stripe returns it as ?session_id=, and the status call takes it.
    return reply(200, { sessionId, checkoutUrl });
  } catch (err) {
    if (!(err instanceof DonationError)) throw err;
    return err.stage === 'insert'
      ? reply(503, { code: 'unavailable', message: 'We couldn’t start your donation just now. Please try again in a moment. Nothing you entered has been lost.' })
      : reply(503, { code: 'unavailable', message: 'We couldn’t open the secure payment page just now. Please try again in a moment. Nothing has been charged.' });
  }
}
