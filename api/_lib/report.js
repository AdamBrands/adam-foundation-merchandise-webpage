import { sql } from './db.js';
import { sourceLabel } from './sources.js';
import { escapeHtml } from './request.js';

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
  const cell = (v) => {
    const s = String(v ?? '');
    // Quote everything; prefix formula-like values so spreadsheets don't execute them.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  return [header.join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\r\n');
}

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
