import { sql } from './db.js';
import { sourceLabel } from './sources.js';
import { escapeHtml } from './request.js';
import { FORMS } from '../../kawthar/assets/forms.js';

// Dates are YYYY-MM-DD in UK time; `to` is inclusive. null means open-ended.
// Test scans and test requests are always left out.
const fromTs = (from) => sql`coalesce((${from}::date)::timestamp at time zone 'Europe/London', '-infinity')`;
const toTs = (to) => sql`coalesce((${to}::date + 1)::timestamp at time zone 'Europe/London', 'infinity')`;

export async function getSummary(from, to) {
  const rows = await sql`
    with s as (
      select code as source, count(*)::int as scans
      from scans
      where code <> 'test' and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
      group by code
    ), r as (
      select source,
             count(*) filter (where email_status <> 'duplicate')::int as requests,
             count(distinct lower(email))::int as people,
             count(distinct lower(email)) filter (where marketing_opt_in)::int as opt_ins
      from book_requests
      where not is_test and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
      group by source
    )
    select source,
           coalesce(scans, 0) as scans,
           coalesce(requests, 0) as requests,
           coalesce(people, 0) as people,
           coalesce(opt_ins, 0) as opt_ins
    from s full join r using (source)
    order by scans desc, requests desc, source`;

  const [totals] = await sql`
    select
      (select count(*)::int from scans
        where code <> 'test' and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}) as scans,
      count(*) filter (where email_status <> 'duplicate')::int as requests,
      count(distinct lower(email))::int as people,
      count(distinct lower(email)) filter (where marketing_opt_in)::int as opt_ins,
      count(*) filter (where email_status = 'failed')::int as failed
    from book_requests
    where not is_test and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}`;

  return { rows, totals };
}

export async function getRequestsCsv(from, to) {
  const rows = await sql`
    select to_char(created_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI:SS') as date_time_uk,
           email, marketing_opt_in, source, device, email_status, consent_version
    from book_requests
    where not is_test and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
    order by created_at`;
  const header = ['date_time_uk', 'email', 'marketing_opt_in', 'source', 'device', 'email_status', 'consent_version'];
  return toCsv(header, rows);
}

// Quote everything; prefix formula-like values so spreadsheets don't execute them.
function cell(v) {
  const s = v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
  return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
}

const toCsv = (header, rows) => [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\r\n');

// Every Kawthar submission in the period (tests left out), one row each. The
// fixed columns come first, then each answer in the order the forms ask for
// it; answers a form doesn't have are blank. Repeats and unpaid donations are
// included, so filter by email_status and payment_status. refunded_gbp and
// dispute_status come from the Stripe webhook.
const SUBMISSION_COLUMNS = ['date_time_uk', 'id', 'page', 'form', 'name', 'email', 'marketing_opt_in', 'source', 'device',
  'email_status', 'payment_status', 'amount_gbp', 'paid_at_uk', 'refunded_gbp', 'dispute_status', 'stripe_payment_intent', 'consent_version'];
const SHOWN = new Set(['email', 'updates', 'amount']);
const PAGE_NAMES = { donation: 'donate', masjid: 'masjids', bottle: 'bottle', partner: 'corporate' };

export async function getKawtharCsv(from, to) {
  const rows = await sql`
    select id, form, name, email, marketing_opt_in, source, device, email_status, payment_status,
           amount_pence, refunded_pence, dispute_status, stripe_payment_intent, consent_version, data,
           to_char(created_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI:SS') as date_time_uk,
           to_char(paid_at at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI:SS') as paid_at_uk
    from kawthar_submissions
    where not is_test and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
    order by created_at`;

  const known = Object.values(FORMS).flatMap((f) => f.fields.map((field) => field.name));
  const present = new Set(rows.flatMap((r) => Object.keys(r.data || {})));
  const answers = [...new Set([...known.filter((k) => present.has(k)), ...[...present].sort()])].filter((k) => !SHOWN.has(k));

  const out = rows.map((r) => {
    const amount = r.amount_pence ? r.amount_pence / 100 : r.data?.amount;
    const row = { ...r, page: PAGE_NAMES[r.form] || 'kawthar (old page)', amount_gbp: amount == null ? '' : Number(amount).toFixed(2),
      refunded_gbp: r.refunded_pence ? (r.refunded_pence / 100).toFixed(2) : '' };
    for (const k of answers) row[`answer_${k}`] = r.data?.[k];
    return row;
  });
  return toCsv([...SUBMISSION_COLUMNS, ...answers.map((k) => `answer_${k}`)], out);
}

// Kawthar pages: visits and completed submissions by source and page. A
// submission counts unless it is a test, a repeat within 10 minutes, or a
// donation that wasn't paid (pledges, made while payments are off, count).
const PAGE_OF_FORM = sql`case form when 'donation' then 'donate' when 'masjid' then 'masjids' when 'bottle' then 'bottle' when 'partner' then 'corporate' end`;

export async function getKawtharSummary(from, to) {
  const rows = await sql`
    with v as (
      select source, page, count(*)::int as visits
      from page_visits
      where source <> 'test' and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
      group by source, page
    ), s as (
      select source, ${PAGE_OF_FORM} as page, count(*)::int as submissions
      from kawthar_submissions
      where not is_test and form in ('donation', 'masjid', 'bottle', 'partner')
        and email_status <> 'duplicate' and payment_status in ('none', 'paid')
        and created_at >= ${fromTs(from)} and created_at < ${toTs(to)}
      group by 1, 2
    )
    select source, page, coalesce(visits, 0) as visits, coalesce(submissions, 0) as submissions
    from v full join s using (source, page)
    order by visits desc, submissions desc, source, page`;
  const totals = rows.reduce((t, r) => ({ visits: t.visits + r.visits, submissions: t.submissions + r.submissions }), { visits: 0, submissions: 0 });
  return { rows, totals };
}

const PAGE_LABELS = { donate: 'Donate', masjids: 'Masjids', bottle: 'Bottle QR', corporate: 'Corporate' };

const pct = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : '–');

// Summary table as HTML with inline styles, used by the report page and the weekly email.
export function summaryTable({ rows, totals }) {
  const th = 'style="text-align:left;padding:8px 10px;background:#061238;color:#fff;font-size:12px;font-weight:600"';
  const td = 'style="padding:8px 10px;border-bottom:1px solid #c9d7e7;font-size:14px"';
  const num = 'style="padding:8px 10px;border-bottom:1px solid #c9d7e7;font-size:14px;text-align:right"';
  const body = rows.length
    ? rows.map((r) => `<tr><td ${td}>${escapeHtml(sourceLabel(r.source))}${sourceLabel(r.source) !== r.source ? ` <span style="color:#4b566d;font-size:12px">(${escapeHtml(r.source)})</span>` : ''}</td>
<td ${num}>${r.scans}</td><td ${num}>${r.requests}</td><td ${num}>${r.opt_ins}</td><td ${num}>${pct(r.requests, r.scans)}</td><td ${num}>${pct(r.opt_ins, r.people)}</td></tr>`).join('')
    : `<tr><td ${td} colspan="6">No activity in this period.</td></tr>`;
  const tf = 'style="padding:8px 10px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #061238"';
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;color:#061238">
<thead><tr><th ${th}>Source</th><th ${th}>QR scans</th><th ${th}>Book requests</th><th ${th}>Marketing opt-ins</th><th ${th}>Scan → request</th><th ${th}>Opt-in rate</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td style="padding:8px 10px;font-size:14px;font-weight:700;border-top:2px solid #061238">Total</td><td ${tf}>${totals.scans}</td><td ${tf}>${totals.requests}</td><td ${tf}>${totals.opt_ins}</td><td ${tf}>${pct(totals.requests, totals.scans)}</td><td ${tf}>${pct(totals.opt_ins, totals.people)}</td></tr></tfoot>
</table>`;
}

// Kawthar visits table as HTML with inline styles, used by the report page.
export function kawtharTable({ rows, totals }) {
  const th = 'style="text-align:left;padding:8px 10px;background:#061238;color:#fff;font-size:12px;font-weight:600"';
  const td = 'style="padding:8px 10px;border-bottom:1px solid #c9d7e7;font-size:14px"';
  const num = 'style="padding:8px 10px;border-bottom:1px solid #c9d7e7;font-size:14px;text-align:right"';
  const body = rows.length
    ? rows.map((r) => `<tr><td ${td}>${escapeHtml(sourceLabel(r.source))}${sourceLabel(r.source) !== r.source ? ` <span style="color:#4b566d;font-size:12px">(${escapeHtml(r.source)})</span>` : ''}</td>
<td ${td}>${escapeHtml(PAGE_LABELS[r.page] || r.page)}</td><td ${num}>${r.visits}</td><td ${num}>${r.submissions}</td><td ${num}>${pct(r.submissions, r.visits)}</td></tr>`).join('')
    : `<tr><td ${td} colspan="5">No activity in this period.</td></tr>`;
  const tf = 'style="padding:8px 10px;font-size:14px;font-weight:700;text-align:right;border-top:2px solid #061238"';
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;color:#061238">
<thead><tr><th ${th}>Source</th><th ${th}>Page</th><th ${th}>Visits</th><th ${th}>Submissions</th><th ${th}>Visit → submission</th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td colspan="2" style="padding:8px 10px;font-size:14px;font-weight:700;border-top:2px solid #061238">Total</td><td ${tf}>${totals.visits}</td><td ${tf}>${totals.submissions}</td><td ${tf}>${pct(totals.submissions, totals.visits)}</td></tr></tfoot>
</table>`;
}
