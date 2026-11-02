# Adam Foundation: connect page (merchandise QR landing page)

Permanent address: https://connect.adamfoundation.com/ (currently served at business.adamfoundation.com until the domain is switched).

The page is static HTML and CSS with no framework or build step. A few Vercel Functions sit beside it:

- `/q/<code>` records a QR scan.
- `/api/book-request` stores an Adhkar book request and emails the book.
- `/report` shows scans, requests and opt-ins by QR code.

Data is held in Supabase. Email is sent through Resend.

## Files

- `index.html`: the page. Includes the Adhkar book form (`#adhkar-book`).
- `assets/css/styles.css`: responsive styles scoped to `#af-discover`.
- `assets/js/book.js`: submits the book form without leaving the page and shows the confirmation. Without JavaScript, the form posts normally.
- `assets/images/`: logos, event photograph, Westminster border and WhatsApp QR image.
- `api/scan.js`: logs a scan (code, device type, time; no IP addresses or cookies), then redirects to `/?src=<code>`.
- `api/book-request.js`: validates the email, stores the request and marketing choice, and sends the book.
- `api/report.js`: password-protected report and CSV download.
- `api/cron/weekly-report.js`: Monday email with the weekly summary and a CSV of all requests.
- `api/cron/keepalive.js`: daily query that stops the free Supabase project pausing.
- `lib/`: shared code. `consent.js` holds the opt-in wording and `sources.js` holds the report names for QR codes.
- `db/schema.sql`: database tables, row-level security and the `connect_writer` role. Already applied.
- `vercel.json`: `/q/:code` and `/report` rewrites, the London function region and the two crons.
- `links.json`: reference list of outbound links (documentation only).
- `references/`, `docs/`: reference material. Not deployed.

## How the book request works

1. The visitor taps "Get your free Adhkar book", enters their email and can tick the marketing box. The box is optional and unticked by default.
2. Every request is stored in `book_requests` with:
   - the email
   - the marketing choice
   - the exact checkbox wording and its version
   - the source (QR code or `direct`)
   - the device type
   - the UK date and time
3. The book is emailed whatever the marketing choice, and the email confirms which choice the person made.
4. A repeat request from the same address within 10 minutes is stored as `duplicate` and not re-sent.
5. If sending fails, the row is marked `failed`. The visitor is told the book will follow, and the report flags it so staff can send it by hand.
6. A hidden "honeypot" field catches simple bots. Their submissions are not stored.

If you change the checkbox wording in `index.html`, update `lib/consent.js` to match and bump `CONSENT_VERSION`.

## QR codes and reporting

Each printed QR code should encode its own link, for example:

```
https://connect.adamfoundation.com/q/tote
https://connect.adamfoundation.com/q/eid-dinner-2026
```

Codes are lowercase letters, numbers and hyphens, up to 40 characters. Any code works without a code change. To give one a friendly name in the report, add it to `lib/sources.js`. Use `/q/test` when testing: test scans and requests are left out of the report.

The report is at `/report`, signed in with `REPORT_USER` (default `adam`) and `REPORT_PASSWORD`. It shows the following per QR code and in total:

- QR scans
- book requests
- marketing opt-ins
- scan-to-request rate
- opt-in rate

It covers the last 7 days, the last 30 days, all time or a custom range, and has a CSV download. The weekly email goes to `REPORT_EMAIL_TO` and attaches every request as a CSV. The free Supabase plan has no backups, so that attachment is the off-site copy.

## Services

**Supabase**

- Project: `adam-foundation-connect` (`xomihzevrziigvjxqmjk`), organisation MB Org, Free plan, London (eu-west-2).
- Tables: `scans` and `book_requests`. Row-level security is on, and the public API keys have no access.
- The site connects as `connect_writer` through the London pooler (transaction mode, port 6543). That role can read and add rows and update request status. It cannot delete rows.

**Resend**

- Send from a subdomain, e.g. `mail.adamfoundation.com`, so the Microsoft 365 setup on the root domain is untouched.
- Add the DNS records Resend gives you for that subdomain, then verify the domain in Resend.

## Environment variables (Vercel project settings)

| Name | Value |
|---|---|
| `DATABASE_URL` | `connect_writer` connection string. The working value is in `.env.local` (not committed). |
| `RESEND_API_KEY` | Resend API key |
| `MAIL_FROM` | e.g. `Adam Foundation <hello@mail.adamfoundation.com>` |
| `MAIL_REPLY_TO` | A monitored Adam Foundation mailbox |
| `BOOK_PDF_URL` | Public link to the PDF, e.g. `https://connect.adamfoundation.com/adhkar/adhkar-book.pdf` |
| `BOOK_ATTACH_PDF` | `false` to send only the download link (default: attach as well) |
| `REPORT_PASSWORD` | Password for `/report` |
| `REPORT_USER` | Optional, defaults to `adam` |
| `REPORT_EMAIL_TO` | Comma-separated recipients of the weekly report |
| `CRON_SECRET` | Random string. Vercel sends it to the cron functions automatically. |

## Go-live checklist

1. Add the Adhkar PDF as `adhkar/<file>.pdf` and set `BOOK_PDF_URL`.
2. Set up Resend and its DNS records, then set the mail variables.
3. Add all environment variables in Vercel and redeploy.
4. Add `connect.adamfoundation.com` to the Vercel project and make it the primary domain. At the DNS host, add the CNAME Vercel shows. Set `business.adamfoundation.com` to redirect (308) to it in Vercel's domain settings.
5. Confirm the privacy policy (https://adamfoundation.com/privacy-policy/) covers the Adhkar book requests and marketing opt-ins.
6. Test on iPhone and Android with printed samples:
   - Scan each QR code.
   - Request the book with and without the opt-in.
   - Receive the email and open the PDF.
   - Tap every social and WhatsApp link.
   - Check each scan and request appears under the right source in `/report`.
7. Delete the test rows, or leave them, since `test` is excluded from reports.

## Design notes

The layout is mobile first, with a maximum content width of 510px. The palette is white `#ffffff`, navy `#061238`, blue `#0055b8` / `#0055a7` and gold `#ad8c60`. These are implementation colours matched to the brochure, not a certified brand palette. Logos are raster extracts from the supplied brochure. If master SVGs or high-resolution transparent PNGs become available, swap them in without redrawing or recolouring.

All external links open in a new tab with `rel="noopener noreferrer"`. The WhatsApp button and QR image both go to https://whatsapp.com/channel/0029Vb9M7AwG8l59M3Nk3L3J (corrected 2 November 2026; the earlier link did not open the channel). The QR image is generated from this link and was decoded to confirm it matches.
