import Stripe from 'stripe';
import { giftAidPence } from '../../kawthar/assets/forms.js';

// Stripe Checkout for Kawthar bottle donations.
//
// Payments are switched on only when STRIPE_SECRET_KEY is set. Without it the
// Donate page records a pledge for the team to follow up. Use a restricted key (rk_…) with only the
// permissions this needs: Checkout Sessions write, PaymentIntents read.
// Keep test keys in Vercel's Preview environment only, so the live site never
// takes test payments.

let client;

export function paymentsEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeClient() {
  if (!paymentsEnabled()) throw new Error('STRIPE_SECRET_KEY is not set');
  // The SDK pins its own API version (2026-10-28.endive for stripe@23.1.0).
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 20000,
    appInfo: { name: 'adam-foundation-kawthar' },
  });
  return client;
}

// Matches every test key prefix: sk_test_, rk_test_, and newer ones such as rkcs_test_.
export const testMode = () => /^[a-z]+_test_/.test(process.env.STRIPE_SECRET_KEY || '');

export const toPence = (pounds) => Math.round(Number(pounds) * 100);

export const formatGBP = (pence) =>
  `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Tags Checkout Sessions in the Stripe Dashboard so this flow can be told
// apart from any other the Foundation adds later.
const INTEGRATION_ID = 'kawthar-donation-qtrbwmzk';

// Creates the hosted Checkout page for one donation. The idempotency key
// means a retried request for the same submission never makes a second session.
// `returnPath` is the page the donor comes back to afterwards.
export async function createDonationSession({ id, form = 'donation', values, source, origin, returnPath = '/donate' }) {
  const pence = toPence(values.amount);
  const onBehalfOf = values.dedication ? { on_behalf_of: String(values.dedication).slice(0, 150) } : {};
  // Stripe has no Gift Aid feature: the Foundation claims it from HMRC using the
  // declaration stored with the submission. These tags let the Dashboard and its
  // exports show which payments carry a declaration. No address goes to Stripe.
  const giftAid = values.gift_aid
    ? { gift_aid: 'yes', gift_aid_declaration: values.gift_aid_declaration?.version ?? '', gift_aid_value: formatGBP(giftAidPence(pence)) }
    : { gift_aid: 'no' };
  return stripeClient().checkout.sessions.create({
    mode: 'payment',
    submit_type: 'donate',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: pence,
        product_data: {
          name: 'Kawthar bottle donation',
          description: 'Helps fund reusable Kawthar bottles for UK mosques this Ramadan.',
        },
      },
    }],
    customer_email: values.email,
    client_reference_id: String(id),
    metadata: { submission_id: String(id), form, source, ...onBehalfOf, ...giftAid },
    payment_intent_data: {
      description: `Kawthar bottle donation #${id}${values.gift_aid ? ' (Gift Aid)' : ''}`,
      metadata: { submission_id: String(id), source, ...onBehalfOf, ...giftAid },
    },
    ...(values.gift_aid ? {
      custom_text: {
        submit: { message: `You’ve added Gift Aid. You pay ${formatGBP(pence)}, and Adam Foundation can claim a further ${formatGBP(giftAidPence(pence))} from HMRC at no extra cost to you.` },
      },
    } : {}),
    success_url: `${origin}${returnPath}?donation=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnPath}?donation=cancelled`,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
    integration_identifier: INTEGRATION_ID,
  }, { idempotencyKey: `kawthar-donation-${id}` });
}
