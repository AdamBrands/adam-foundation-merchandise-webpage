import { timingSafeEqual } from 'node:crypto';
import { getRequestsCsv, getSummary, summaryTable } from '../lib/report.js';
import { escapeHtml, londonDate } from '../lib/request.js';

// Private report at /report (rewritten here by vercel.json), protected by HTTP
// Basic Auth. ?range=7|30|all, or ?from=YYYY-MM-DD&to=YYYY-MM-DD. ?format=csv
// downloads the book requests for the same period.
export async function GET(request) {
  const password = process.env.REPORT_PASSWORD;
  if (!password) return new Response('Report is not configured.', { status: 503 });
  if (!authorised(request, process.env.REPORT_USER || 'adam', password)) {
    return new Response('Sign in required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Adam Foundation report", charset="UTF-8"' },
    });
  }

  const params = new URL(request.url).searchParams;
  const { from, to, range } = period(params);

  if (params.get('format') === 'csv') {
    const csv = await getRequestsCsv(from, to);
    return new Response(`﻿${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="adhkar-book-requests_${from || 'start'}_to_${to || londonDate()}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  const summary = await getSummary(from, to);
  const query = range === 'custom' ? `from=${from}&to=${to}` : `range=${range}`;
  const tab = (value, label) => (range === value
    ? `<strong>${label}</strong>`
    : `<a href="?range=${value}">${label}</a>`);

  return new Response(`<!doctype html><html lang="en-GB"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Connect page report · Adam Foundation</title>
<style>
body{margin:0;font-family:Arial,sans-serif;color:#061238;background:#fff}
main{max-width:860px;margin:0 auto;padding:32px 16px}
h1{font-size:26px;margin:0 0 6px}.sub{color:#4b566d;font-size:14px;margin:0 0 20px}
nav,form{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:14px;margin:0 0 14px}
a{color:#0055b8}input{font:inherit;padding:4px 6px}button{font:inherit;padding:5px 12px;background:#0055b8;color:#fff;border:0;border-radius:3px}
.wrap{overflow-x:auto;margin:18px 0}.note{font-size:13px;line-height:1.6;color:#4b566d}.warn{background:#fff5e6;border-left:4px solid #ad8c60;padding:10px 12px;font-size:14px}
.csv{display:inline-block;margin-top:6px;background:#0055b8;color:#fff;text-decoration:none;padding:10px 14px;border-radius:3px;font-size:14px}
</style></head><body><main>
<h1>Connect page report</h1>
<p class="sub">${from ? `${escapeHtml(from)} to ${escapeHtml(to || londonDate())}` : 'All time'} · UK time · test data excluded</p>
<nav>${tab('7', 'Last 7 days')}${tab('30', 'Last 30 days')}${tab('all', 'All time')}</nav>
<form method="get"><label>From <input type="date" name="from" value="${escapeHtml(from || '')}" required></label>
<label>To <input type="date" name="to" value="${escapeHtml(to || '')}" required></label><button>Show</button></form>
${summary.totals.failed ? `<p class="warn">${summary.totals.failed} book email${summary.totals.failed === 1 ? '' : 's'} failed to send in this period. Filter the CSV by email_status = failed and send these by hand.</p>` : ''}
<div class="wrap">${summaryTable(summary)}</div>
<a class="csv" href="?${query}&amp;format=csv">Download book requests (CSV)</a>
<p class="note">QR scans count each time a printed code is opened. Book requests exclude repeat requests from the same address within 10 minutes. The opt-in rate is marketing opt-ins divided by the number of different people who asked for the book. Totals count each person once, so they can be lower than the sum of the rows.</p>
</main></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function period(params) {
  const from = params.get('from');
  const to = params.get('to');
  if (DATE_RE.test(from || '') && DATE_RE.test(to || '')) return { from, to, range: 'custom' };
  const range = ['7', '30', 'all'].includes(params.get('range')) ? params.get('range') : '30';
  if (range === 'all') return { from: null, to: null, range };
  return { from: londonDate(-(Number(range) - 1)), to: londonDate(), range };
}

function authorised(request, user, password) {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  const given = Buffer.from(Buffer.from(header.slice(6), 'base64').toString('utf8'));
  const expected = Buffer.from(`${user}:${password}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
