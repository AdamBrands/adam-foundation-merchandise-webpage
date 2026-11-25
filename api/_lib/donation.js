import { sql } from './db.js';
import { deviceFrom } from './request.js';
import { createDonationSession, formatGBP, paymentsEnabled, stripeClient, testMode, toPence } from './stripe.js';
import { DONATION_TYPE, GIFT_AID, consentFor, gbp, submitterName } from '../../kawthar/assets/forms.js';

// Online donations, shared by connect's own Donate page (api/kawthar.js) and
// the donations API that adamfoundation.com calls (api/donations.js). Both
// store the same kawthar_submissions row (form "donation") and open the same
// Stripe Checkout session, so api/stripe-webhook.js, the receipt, the team
// notification, Gift Aid and /report treat them alike.

// Thrown by startDonation. `stage` says what failed: "insert" (nothing was
// stored) or "checkout" (the row is stored and marked payment_status "error").
export class DonationError extends Error {
  constructor(stage, cause) {
    super(cause?.message ?? stage);
    this.stage = stage;
    this.cause = cause;
  }
}

// Server-set parts of a validated donation, never taken from the browser:
// every donation is Sadaqah, and a ticked Gift Aid box is recorded as a
// declaration with this wording, version and the server's time. It covers
// this donation only. Unticked donations carry gift_aid: false.
export function prepareDonation(values) {
  values.donation_type = DONATION_TYPE.key;
  if (values.gift_aid) {
    values.gift_aid_declaration = {
      text: GIFT_AID.declaration(gbp(values.amount)),
      version: GIFT_AID.version,
      scope: GIFT_AID.scope,
      declared_at: new Date().toISOString(),
    };
  }
  return values;
}

// Stores a validated, prepared donation with payment_status "pending" and
// opens a Stripe Checkout session. `returnTo` is the full address (no query)
// of the page Stripe sends the donor back to. Returns { id, checkoutUrl }.
export async function startDonation({ request, values, source, returnTo }) {
  const form = 'donation';
  const consent = consentFor(form);
  let id;
  try {
    [{ id }] = await sql`
      insert into kawthar_submissions
        (form, name, email, data, marketing_opt_in, consent_text, consent_version, source, device, is_test,
         email_status, payment_status, amount_pence)
      values
        (${form}, ${submitterName(form, values)}, ${values.email}, ${sql.json(values)}, ${values.updates === true},
         ${consent.text}, ${consent.version}, ${source}, ${deviceFrom(request)}, ${source === 'test' || testMode()},
         'pending', 'pending', ${toPence(values.amount)})
      returning id`;
  } catch (err) {
    console.error('kawthar donation insert failed', err);
    throw new DonationError('insert', err);
  }

  try {
    const session = await createDonationSession({ id, form, values, source, returnTo });
    await sql`update kawthar_submissions set stripe_session_id = ${session.id} where id = ${id}`;
    return { id, checkoutUrl: session.url };
  } catch (err) {
    console.error('stripe checkout session failed', err);
    await sql`
      update kawthar_submissions set payment_status = 'error', email_error = ${String(err.message).slice(0, 500)}
      where id = ${id}`.catch((e) => console.error('status update failed', e));
    throw new DonationError('checkout', err);
  }
}

// A donation's status for the thank-you screen after Stripe Checkout (amount
// and status only), or null when the session is unknown or not a donation.
export async function donationStatus(sessionId) {
  if (!paymentsEnabled() || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(String(sessionId))) return null;
  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.form !== 'donation') return null;
    return {
      paid: session.payment_status !== 'unpaid',
      status: session.status,
      amount: formatGBP(session.amount_total ?? 0),
    };
  } catch (err) {
    console.error('stripe session lookup failed', err.message);
    return null;
  }
}
