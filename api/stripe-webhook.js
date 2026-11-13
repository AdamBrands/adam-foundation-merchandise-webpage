import { sql } from './_lib/db.js';
import { sendEmail } from './_lib/email.js';
import { donationEmails } from './_lib/kawthar-email.js';
import { formatGBP, paymentsEnabled, stripeClient } from './_lib/stripe.js';

// Stripe webhook for Kawthar donations. Set it up in the Stripe Dashboard
// (Developers → Webhooks) pointing at /api/stripe-webhook, listening for:
//   checkout.session.completed
//   checkout.session.async_payment_succeeded
//   checkout.session.async_payment_failed
//   checkout.session.expired
//   charge.refunded
//   charge.dispute.created
//   charge.dispute.updated
//   charge.dispute.closed
// and put its signing secret in STRIPE_WEBHOOK_SECRET.
//
// A donation is only marked paid, and its receipt and team notification only
// sent, here: never from the thank-you page, which a donor may never reach.
// The update below only matches a row that isn't already paid, so Stripe
// retrying an event never sends the emails twice.
//
// Refunds and disputes are recorded beside payment_status (which stays the
// Checkout outcome) so a refunded or disputed donation is left out of a Gift
// Aid claim. Both are matched by the donation's PaymentIntent.
export async function POST(request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!paymentsEnabled() || !secret) return new Response('Payments are not configured', { status: 503 });

  const body = await request.text();
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(body, request.headers.get('stripe-signature') || '', secret);
  } catch (err) {
    console.error('stripe webhook signature failed', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  const object = event.data.object;
  let handled = false;
  try {
    if (object?.object === 'checkout.session') handled = await handleSession(event.type, object);
    else if (event.type === 'charge.refunded') handled = await recordRefund(object);
    else if (event.type.startsWith('charge.dispute.')) handled = await recordDispute(object);
  } catch (err) {
    // Database trouble: answer 500 so Stripe retries the event later.
    console.error('stripe webhook handling failed', event.type, err);
    return new Response('Handler error', { status: 500 });
  }
  return Response.json(handled ? { received: true } : { received: true, ignored: true });
}

// Only Checkout sessions from the Donate page (/donate).
async function handleSession(type, session) {
  if (session.metadata?.form !== 'donation') return false;
  switch (type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (session.payment_status === 'unpaid') {
        // Delayed payment methods (e.g. bank debits) confirm later.
        await sql`update kawthar_submissions set payment_status = 'processing'
                  where stripe_session_id = ${session.id} and payment_status = 'pending'`;
      } else {
        await fulfil(session);
      }
      break;
    case 'checkout.session.async_payment_failed':
      await sql`update kawthar_submissions set payment_status = 'failed'
                where stripe_session_id = ${session.id} and payment_status <> 'paid'`;
      break;
    case 'checkout.session.expired':
      await sql`update kawthar_submissions set payment_status = 'expired'
                where stripe_session_id = ${session.id} and payment_status in ('pending', 'processing')`;
      break;
    default:
      break;
  }
  return true;
}

const idOf = (v) => (typeof v === 'string' ? v : v?.id) || null;

// charge.refunded fires for full and partial refunds, and amount_refunded is
// the running total. Events can arrive out of order, so the stored total only
// ever goes up. A refund that later fails therefore stays counted: that keeps
// the donation out of a claim (the safe side) until someone corrects it.
async function recordRefund(charge) {
  const paymentIntent = idOf(charge?.payment_intent);
  const refunded = Number(charge?.amount_refunded) || 0;
  if (!paymentIntent || refunded <= 0) return false;
  const rows = await sql`
    update kawthar_submissions
    set refunded_pence = greatest(refunded_pence, ${refunded}),
        refunded_at = case when ${refunded} > refunded_pence then now() else refunded_at end
    where stripe_payment_intent = ${paymentIntent} and form = 'donation'
    returning id, refunded_pence`;
  if (rows.length) console.info('kawthar donation refunded', rows[0].id, `total ${rows[0].refunded_pence}p`);
  return rows.length > 0;
}

// Stripe allows one dispute per charge. Its status runs from needs_response
// (or warning_* for an inquiry) to won, lost or prevented; a late event for an
// earlier stage never overwrites one of those.
const FINAL_DISPUTE = ['won', 'lost', 'prevented'];

async function recordDispute(dispute) {
  const paymentIntent = idOf(dispute?.payment_intent);
  if (dispute?.object !== 'dispute' || !paymentIntent || !dispute.status) return false;
  const rows = await sql`
    update kawthar_submissions
    set dispute_status = case
          when dispute_status in ${sql(FINAL_DISPUTE)} and ${dispute.status} not in ${sql(FINAL_DISPUTE)} then dispute_status
          else ${dispute.status} end,
        disputed_at = coalesce(disputed_at, ${new Date((dispute.created || Date.now() / 1000) * 1000)})
    where stripe_payment_intent = ${paymentIntent} and form = 'donation'
    returning id, dispute_status`;
  if (rows.length) console.warn('kawthar donation disputed', rows[0].id, rows[0].dispute_status);
  return rows.length > 0;
}

async function fulfil(session) {
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  const rows = await sql`
    update kawthar_submissions
    set payment_status = 'paid', paid_at = now(), amount_pence = ${session.amount_total},
        stripe_payment_intent = ${paymentIntent ?? null}
    where stripe_session_id = ${session.id} and payment_status <> 'paid'
    returning id, form, data, marketing_opt_in, source`;
  if (!rows.length) return; // already handled, or not one of ours

  const [submission] = rows;
  const amount = formatGBP(session.amount_total ?? 0);
  const { receipt, notify } = donationEmails({ submission, amount, amountPence: session.amount_total ?? 0, reference: paymentIntent || session.id });

  const ids = [];
  const problems = [];
  for (const [who, message] of [['person', receipt], ['team', notify]]) {
    try {
      ids.push(await sendEmail(message));
    } catch (err) {
      console.error(`kawthar donation ${who} email failed`, err);
      problems.push(`${who}: ${err.message}`);
    }
  }
  const status = problems.length === 0 ? 'sent' : problems.length === 2 ? 'failed' : 'partial';
  await sql`
    update kawthar_submissions
    set email_status = ${status}, email_id = ${ids.join(',') || null},
        email_error = ${problems.length ? problems.join(' | ').slice(0, 500) : null}
    where id = ${submission.id}`.catch((e) => console.error('status update failed', e));
}
