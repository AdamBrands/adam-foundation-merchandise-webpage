import { sql } from './_lib/db.js';
import { bookEmail, sendEmail } from './_lib/email.js';
import { confirmationEmail, notificationEmail } from './_lib/kawthar-email.js';
import { cleanCode, deviceFrom } from './_lib/request.js';
import { createDonationSession, formatGBP, paymentsEnabled, stripeClient, testMode, toPence } from './_lib/stripe.js';
import { DONATION_TYPE, FORMS, GIFT_AID, consentFor, gbp, isDonation, submitterName, validate } from '../kawthar/assets/forms.js';

const MAX_BODY = 32 * 1024;

// Receives the four Kawthar page forms as JSON from kawthar/assets/audience.js:
// Masjid application, corporate partnership enquiry, donation and the bottle
// QR adhkar book request. The same rules as the pages (kawthar/assets/forms.js)
// are applied again here. Every valid submission
// is stored in kawthar_submissions, then the person gets a copy (or the book)
// and the team gets a notification. A repeat of the same form from the same
// address within 10 minutes is stored as "duplicate" and not re-sent.
//
// Donations (the Donate page's form while STRIPE_SECRET_KEY is set) are stored
// with payment_status "pending" and the visitor is sent to Stripe Checkout.
// Without the key, a donation is recorded as a pledge and emailed like the
// other forms. No email goes out here: api/stripe-webhook.js sends the
// receipt and the team notification once Stripe confirms the payment.
export async function POST(request) {
  const reply = (status, body) => Response.json({ ok: status < 400, ...body }, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

  if (Number(request.headers.get('content-length') || 0) > MAX_BODY) {
    return reply(413, { message: 'That’s too much text to send. Please shorten your answers and try again.' });
  }
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) throw new Error('too large');
    payload = JSON.parse(raw);
  } catch {
    return reply(400, { message: 'Something went wrong. Please try again.' });
  }

  const form = typeof payload?.form === 'string' && Object.hasOwn(FORMS, payload.form) ? payload.form : null;
  if (!form) return reply(400, { message: 'Something went wrong. Please refresh the page and try again.' });

  // Honeypot: people never see this field, bots fill it in. Not stored.
  if (payload.nickname) return reply(200, { message: FORMS[form].success });

  const data = payload.data && typeof payload.data === 'object' ? payload.data : {};
  const { values, errors } = validate(form, data);
  if (Object.keys(errors).length) {
    return reply(422, { message: 'Please correct the highlighted answers.', errors });
  }

  // Every donation (paid or pledged) is recorded as Sadaqah; never taken from the browser.
  if (form === 'donation') values.donation_type = DONATION_TYPE.key;

  // Gift Aid: the declaration is recorded here, with the server's time, not
  // taken from the browser. It is stored with the donation (data jsonb) and
  // covers this donation only. Unticked donations carry gift_aid: false.
  if (form === 'donation' && values.gift_aid) {
    values.gift_aid_declaration = {
      text: GIFT_AID.declaration(gbp(values.amount)),
      version: GIFT_AID.version,
      scope: GIFT_AID.scope,
      declared_at: new Date().toISOString(),
    };
  }

  const source = cleanCode(payload.source) || 'kawthar';
  const optIn = values.updates === true;
  const name = submitterName(form, values);
  const consent = consentFor(form);

  if (isDonation(form, paymentsEnabled())) {
    return startDonation({ request, reply, form, name, values, source, optIn, consent });
  }

  let id;
  let duplicate;
  try {
    [{ duplicate }] = await sql`
      select exists (
        select 1 from kawthar_submissions
        where form = ${form}
          and lower(email) = lower(${values.email})
          and email_status = 'sent'
          and created_at > now() - interval '10 minutes'
      ) as duplicate`;
    [{ id }] = await sql`
      insert into kawthar_submissions
        (form, name, email, data, marketing_opt_in, consent_text, consent_version, source, device, is_test, email_status)
      values
        (${form}, ${name}, ${values.email}, ${sql.json(values)}, ${optIn}, ${consent.text},
         ${consent.version}, ${source}, ${deviceFrom(request)}, ${source === 'test'},
         ${duplicate ? 'duplicate' : 'pending'})
      returning id`;
  } catch (err) {
    console.error('kawthar insert failed', err);
    return reply(503, { message: 'We couldn’t send your details just now. Please try again in a moment. Nothing you entered has been lost.' });
  }

  if (duplicate) return reply(200, { message: successMessage(form, values, true) });

  // The person's email first, so the team notification can say whether it went.
  const ids = [];
  const problems = [];
  let personEmailed = false;
  try {
    const message = form === 'bottle'
      ? await bookEmail({
        email: values.email,
        optIn,
        name,
        optInText: 'You also asked to receive email news from Community Exchange Hub and Adam Foundation.',
        tag: 'kawthar-bottle-book',
      })
      : confirmationEmail({ form, values, optIn });
    ids.push(await sendEmail(message));
    personEmailed = true;
  } catch (err) {
    console.error('kawthar person email failed', err);
    problems.push(`person: ${err.message}`);
  }
  try {
    ids.push(await sendEmail(notificationEmail({ form, values, id, source, personEmailed })));
  } catch (err) {
    console.error('kawthar team email failed', err);
    problems.push(`team: ${err.message}`);
  }

  const status = problems.length === 0 ? 'sent' : problems.length === 2 ? 'failed' : 'partial';
  await sql`
    update kawthar_submissions
    set email_status = ${status}, email_id = ${ids.join(',') || null},
        email_error = ${problems.length ? problems.join(' | ').slice(0, 500) : null}
    where id = ${id}`.catch((e) => console.error('kawthar status update failed', e));

  return reply(200, { message: successMessage(form, values, personEmailed), emailed: personEmailed });
}

function successMessage(form, values, emailed) {
  if (form === 'bottle') {
    return emailed
      ? `We’ve sent the adhkar book to ${values.email}. It should arrive in a few minutes. If you can’t see it, please check your junk folder.`
      : 'We’ve saved your request, but the email didn’t send straight away. We’ll send your book to you shortly.';
  }
  const what = {
    masjid: 'your Masjid’s application',
    partner: 'your partnership enquiry',
    donation: 'your pledge',
  }[form];
  return emailed
    ? `${FORMS[form].success}`
    : `Thank you. We’ve received ${what}, but couldn’t email you a copy just now. Our team has your details and will be in touch.`;
}

// Stores the submission as a pending donation and opens a Stripe Checkout
// session. The donor comes back to the Donate page afterwards.
async function startDonation({ request, reply, form, name, values, source, optIn, consent }) {
  let id;
  try {
    [{ id }] = await sql`
      insert into kawthar_submissions
        (form, name, email, data, marketing_opt_in, consent_text, consent_version, source, device, is_test,
         email_status, payment_status, amount_pence)
      values
        (${form}, ${name}, ${values.email}, ${sql.json(values)}, ${optIn}, ${consent.text},
         ${consent.version}, ${source}, ${deviceFrom(request)}, ${source === 'test' || testMode()},
         'pending', 'pending', ${toPence(values.amount)})
      returning id`;
  } catch (err) {
    console.error('kawthar donation insert failed', err);
    return reply(503, { message: 'We couldn’t start your donation just now. Please try again in a moment. Nothing you entered has been lost.' });
  }

  try {
    const session = await createDonationSession({
      id, form, values, source, origin: new URL(request.url).origin, returnPath: FORMS[form].page,
    });
    await sql`update kawthar_submissions set stripe_session_id = ${session.id} where id = ${id}`;
    return reply(200, { checkoutUrl: session.url });
  } catch (err) {
    console.error('stripe checkout session failed', err);
    await sql`
      update kawthar_submissions set payment_status = 'error', email_error = ${String(err.message).slice(0, 500)}
      where id = ${id}`.catch((e) => console.error('status update failed', e));
    return reply(503, { message: 'We couldn’t open the secure payment page just now. Please try again in a moment. Nothing has been charged.' });
  }
}

// GET /api/kawthar tells the page whether online donations are on.
// GET /api/kawthar?session_id=cs_… reports a donation's status for the
// thank-you screen after Stripe Checkout (amount and status only).
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId) return Response.json({ payments: paymentsEnabled(), testMode: paymentsEnabled() && testMode() }, { headers });

  if (!paymentsEnabled() || !/^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(sessionId)) {
    return Response.json({ ok: false }, { status: 404, headers });
  }
  try {
    const session = await stripeClient().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.form !== 'donation') return Response.json({ ok: false }, { status: 404, headers });
    return Response.json({
      ok: true,
      paid: session.payment_status !== 'unpaid',
      status: session.status,
      amount: formatGBP(session.amount_total ?? 0),
    }, { headers });
  } catch (err) {
    console.error('stripe session lookup failed', err.message);
    return Response.json({ ok: false }, { status: 404, headers });
  }
}
