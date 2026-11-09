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
// and put its signing secret in STRIPE_WEBHOOK_SECRET.
//
// A donation is only marked paid, and its receipt and team notification only
// sent, here: never from the thank-you page, which a donor may never reach.
// The update below only matches a row that isn't already paid, so Stripe
// retrying an event never sends the emails twice.
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

  const session = event.data.object;
  // Only Checkout sessions from the Donate page (/donate).
  if (session?.object !== 'checkout.session' || session.metadata?.form !== 'donation') {
    return Response.json({ received: true, ignored: true });
  }

  try {
    switch (event.type) {
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
  } catch (err) {
    // Database trouble: answer 500 so Stripe retries the event later.
    console.error('stripe webhook handling failed', event.type, err);
    return new Response('Handler error', { status: 500 });
  }
  return Response.json({ received: true });
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
  const { receipt, notify } = donationEmails({ submission, amount, reference: paymentIntent || session.id });

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
