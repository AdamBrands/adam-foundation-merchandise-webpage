import { sql } from './_lib/db.js';
import { bookEmail, sendEmail } from './_lib/email.js';
import { confirmationEmail, notificationEmail } from './_lib/kawthar-email.js';
import { KAWTHAR_CONSENT_VERSION } from './_lib/consent.js';
import { cleanCode, deviceFrom } from './_lib/request.js';
import { FORMS, UPDATES_LABEL, validate } from '../kawthar/assets/forms.js';

const MAX_BODY = 32 * 1024;

// Receives the three Kawthar forms (mosque application, support offer, book
// request) as JSON from kawthar/assets/app.js. The same rules as the page
// (kawthar/assets/forms.js) are applied again here. Every valid submission
// is stored in kawthar_submissions, then the person gets a copy (or the book)
// and the team gets a notification. A repeat of the same form from the same
// address within 10 minutes is stored as "duplicate" and not re-sent.
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

  const source = cleanCode(payload.source) || 'kawthar';
  const optIn = values.updates === true;

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
        (${form}, ${values.name}, ${values.email}, ${sql.json(values)}, ${optIn}, ${UPDATES_LABEL},
         ${KAWTHAR_CONSENT_VERSION}, ${source}, ${deviceFrom(request)}, ${source === 'test'},
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
    const message = form === 'book'
      ? await bookEmail({
        email: values.email,
        optIn,
        name: values.name,
        optInText: 'You also asked to receive email news from Adam Foundation, including Community Exchange Hub, Avicenna Foundation and Adam Hub.',
        tag: 'kawthar-book',
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
  if (form === 'book') {
    return emailed
      ? `We’ve sent the adhkar book to ${values.email}. It should arrive in a few minutes. If you can’t see it, please check your junk folder.`
      : 'We’ve saved your request, but the email didn’t send straight away. We’ll send your book to you shortly.';
  }
  const what = form === 'mosque' ? 'your mosque’s application' : 'your offer of support';
  return emailed
    ? `${FORMS[form].success}`
    : `Thank you. We’ve received ${what}, but couldn’t email you a copy just now. Our team has your details and will be in touch.`;
}
