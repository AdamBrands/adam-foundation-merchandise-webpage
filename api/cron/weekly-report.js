import { getKawtharSummary, getRequestsCsv, getSummary, kawtharTable, summaryTable } from '../_lib/report.js';
import { sendEmail } from '../_lib/email.js';
import { isCron, londonDate } from '../_lib/request.js';

// Vercel cron, Mondays (see vercel.json). Emails the last 7 days and all-time
// totals (Adhkar book QR codes, and Kawthar page visits and submissions) to REPORT_EMAIL_TO, with every book request attached as a CSV. The
// attachment doubles as an off-site copy, as the free Supabase plan has no backups.
export async function GET(request) {
  if (!isCron(request)) return new Response('Unauthorised', { status: 401 });

  const recipients = (process.env.REPORT_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) return new Response('REPORT_EMAIL_TO is not set', { status: 503 });

  const from = londonDate(-7);
  const to = londonDate(-1);
  const [week, allTime, kawtharWeek, kawtharAllTime, csv] = await Promise.all([
    getSummary(from, to),
    getSummary(null, null),
    getKawtharSummary(from, to),
    getKawtharSummary(null, null),
    getRequestsCsv(null, null),
  ]);

  const h2 = 'style="font-size:18px;margin:28px 0 10px"';
  const h3 = 'style="font-size:15px;margin:18px 0 8px;color:#4b566d"';
  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;padding:24px 12px;font-family:Arial,sans-serif;color:#061238">
<div style="max-width:720px;margin:0 auto">
<h1 style="font-size:22px;margin:0 0 6px">Connect page: weekly report</h1>
<p style="margin:0 0 4px;color:#4b566d;font-size:14px">connect.adamfoundation.com · UK time · test data excluded</p>
${week.totals.failed ? `<p style="background:#fff5e6;border-left:4px solid #ad8c60;padding:10px 12px;font-size:14px">${week.totals.failed} book email(s) failed to send last week. See email_status = failed in the attached CSV.</p>` : ''}
<h2 ${h2}>Last 7 days (${from} to ${to})</h2>
<h3 ${h3}>Adhkar book (QR codes)</h3>${summaryTable(week)}
<h3 ${h3}>Kawthar pages</h3>${kawtharTable(kawtharWeek)}
<h2 ${h2}>All time</h2>
<h3 ${h3}>Adhkar book (QR codes)</h3>${summaryTable(allTime)}
<h3 ${h3}>Kawthar pages</h3>${kawtharTable(kawtharAllTime)}
<p style="font-size:13px;color:#4b566d;line-height:1.6;margin-top:24px">Kawthar visits count each time /donate, /masjids, /bottle or /corporate opens (counted from 12 November 2026), by the ?src= code the visitor arrived with. Submissions leave out tests, repeats within 10 minutes and unpaid donations. The attached CSV lists every book request to date, including each person’s marketing choice. The live report, with custom date ranges, is at https://connect.adamfoundation.com/report</p>
</div></body></html>`;

  await sendEmail({
    to: recipients,
    subject: `Connect page report: ${week.totals.scans} scans, ${week.totals.requests} book requests, ${kawtharWeek.totals.visits} Kawthar visits (${from} to ${to})`,
    html,
    text: `Last 7 days (${from} to ${to}): ${week.totals.scans} QR scans, ${week.totals.requests} book requests, ${week.totals.opt_ins} marketing opt-ins.\nAll time: ${allTime.totals.scans} QR scans, ${allTime.totals.requests} book requests, ${allTime.totals.opt_ins} marketing opt-ins.\nKawthar pages, last 7 days: ${kawtharWeek.totals.visits} visits, ${kawtharWeek.totals.submissions} submissions. All time: ${kawtharAllTime.totals.visits} visits, ${kawtharAllTime.totals.submissions} submissions.\nFull report: https://connect.adamfoundation.com/report`,
    attachments: [{
      type: 'text/csv',
      name: `adhkar-book-requests_to_${to}.csv`,
      content: Buffer.from(`﻿${csv}`).toString('base64'),
    }],
    tags: ['weekly-report'],
  });

  return Response.json({ ok: true, from, to });
}
