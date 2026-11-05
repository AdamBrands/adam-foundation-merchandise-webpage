# Adam Foundation: connect page (merchandise QR landing page)

Permanent address: https://connect.adamfoundation.com/ (currently served at business.adamfoundation.com until the domain is switched).

The page is static HTML and CSS with no framework or build step. A few Vercel Functions sit beside it:

- `/q/<code>` records a QR scan.
- `/api/book-request` stores an Adhkar book request and emails the book.
- `/report` shows scans, requests and opt-ins by QR code.
- `/kawthar` is the Kawthar campaign page. `/api/kawthar` receives its three forms (see [Kawthar page](#kawthar-page)).

Data is held in Supabase. Email is sent through Mandrill (Mailchimp Transactional), using the Foundation's existing account.

## Files

- `index.html`: the page. Includes the Adhkar book form (`#adhkar-book`).
- `assets/css/styles.css`: responsive styles scoped to `#af-discover`.
- `assets/js/book.js`: submits the book form without leaving the page and shows the confirmation. Without JavaScript, the form posts normally.
- `assets/images/`: logos, Westminster banner, Westminster skyline border and WhatsApp QR image.
- `api/scan.js`: logs a scan (code, device type, time; no IP addresses or cookies), then redirects to `/?src=<code>`. Link previews and bots are redirected but not logged, using the same rules as the RMS portal's dynamic QR counter.
- `api/book-request.js`: validates the email, stores the request and marketing choice, and sends the book.
- `api/report.js`: password-protected report and CSV download.
- `api/cron/weekly-report.js`: Monday email with the weekly summary and a CSV of all requests.
- `api/cron/keepalive.js`: daily query that stops the free Supabase project pausing.
- `api/_lib/`: shared code. `consent.js` holds the opt-in wording and `sources.js` holds the report names for QR codes. The underscore keeps this folder private: Vercel neither publishes it nor turns it into web addresses.
- `kawthar/`: the Kawthar campaign page (`index.html`, `assets/styles.css`, `assets/app.js`) and `assets/forms.js`, the form fields and validation rules shared by the page and `api/kawthar.js`.
- `api/kawthar.js`: validates and stores Kawthar form submissions, emails the person and the team. Emails are built in `api/_lib/kawthar-email.js`.
- `db/schema.sql`: database tables, row-level security and the `connect_writer` role.
- `adhkar/adhkar-book.pdf`: the book ("Daily Adhkar", 82 pages), published at `/adhkar/adhkar-book.pdf`. It's a lighter copy of the designer's print file "ADHKAR BOOK (Perfect bound) version 2.pdf". Only the background images are recompressed, and the text and artwork are unchanged (23 MB instead of 27 MB).
- `vercel.json`: `/q/:code` and `/report` rewrites, the London function region, the PDF bundling and the two crons.
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

If you change the checkbox wording in `index.html`, update `api/_lib/consent.js` to match and bump `CONSENT_VERSION`.

## QR codes and reporting

The printed codes are dynamic QR codes from the RMS portal. Each one encodes an RMS short link (`qr.michalblance.com/q/…`), which counts the scan and forwards to the destination set in the portal. Set each code's destination (type "Website URL") to its own link here, for example:

```
https://connect.adamfoundation.com/q/tote
https://connect.adamfoundation.com/q/eid-dinner-2026
```

Codes are lowercase letters, numbers and hyphens, up to 40 characters. Any code works without a code change. To give one a friendly name in the report, add it to `api/_lib/sources.js`. Use `/q/test` when testing: test scans and requests are left out of the report.

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

**Mandrill**

- The sending domain is `adamfoundation.com` itself, also used by Microsoft 365. It's set up in Mandrill under Settings → Domains → Sending Domains. Its records in GoDaddy:
  - Ownership: TXT `mandrill_verify.…` on `adamfoundation.com` (in place)
  - DKIM: CNAMEs `mte1._domainkey` → `dkim1.mandrillapp.com` and `mte2._domainkey` → `dkim2.mandrillapp.com` (in place)
  - SPF: the domain must keep **one** SPF record, covering both senders: `v=spf1 include:spf.protection.outlook.com include:spf.mandrillapp.com -all`. Edit the existing record rather than adding a second. Two SPF records break the check for Microsoft 365 email too.
- Mandrill must show the domain as verified, with DKIM and SPF valid, before it will send. Mandrill's DKIM signature matches the From address, so the domain's DMARC policy (`p=quarantine`) passes.
- Open and click tracking are switched off in the code, so links stay as written.
- Emails are tagged `adhkar-book` or `weekly-report` in Mandrill's activity log.
- The book is attached from the copy deployed with the site, but only when it is 10 MB or smaller. Attachments grow by a third when sent, and many inboxes refuse emails over 20–25 MB. The current book is 23 MB, so the email carries the download link only. If the file is missing, the email still goes out with the link.

## Environment variables (Vercel project settings)

| Name | Value |
|---|---|
| `DATABASE_URL` | `connect_writer` connection string. The working value is in `.env.local` (not committed). |
| `MANDRILL_API_KEY` | Mandrill API key (Mandrill → Settings → SMTP & API Info) |
| `MAIL_FROM` | e.g. `Adam Foundation <hello@adamfoundation.com>`. Use a real or aliased Microsoft 365 address, so bounces and replies reach someone. |
| `MAIL_REPLY_TO` | A monitored Adam Foundation mailbox |
| `BOOK_PDF_URL` | Download link shown in the email: `https://connect.adamfoundation.com/adhkar/adhkar-book.pdf` |
| `BOOK_ATTACH_PDF` | `false` to send only the download link (default: attach the PDF as well) |
| `REPORT_PASSWORD` | Password for `/report` |
| `REPORT_USER` | Optional, defaults to `adam` |
| `REPORT_EMAIL_TO` | Comma-separated recipients of the weekly report |
| `KAWTHAR_NOTIFY_TO` | Optional. Who receives Kawthar form notifications, comma-separated. Defaults to `info@adamfoundation.com`. |
| `CRON_SECRET` | Random string. Vercel sends it to the cron functions automatically. |

## Go-live checklist

1. The Adhkar PDF is at `adhkar/adhkar-book.pdf`. Set `BOOK_PDF_URL`. To replace the book later, overwrite that file and redeploy. Books over 10 MB are sent as a link only.
2. Add Mandrill to the SPF record (see Mandrill above), check that Mandrill shows `adamfoundation.com` as verified, then set the mail variables.
3. Add all environment variables in Vercel and redeploy.
4. Make `connect.adamfoundation.com` the primary domain in Vercel. Its DNS record is already in place and serves over HTTPS. Set `business.adamfoundation.com` to redirect (308) to it in Vercel's domain settings.
5. Confirm the privacy policy (https://adamfoundation.com/privacy-policy/) covers the Adhkar book requests and marketing opt-ins.
6. Test on iPhone and Android with printed samples:
   - Scan each QR code.
   - Request the book with and without the opt-in.
   - Receive the email and open the PDF.
   - Tap every social and WhatsApp link.
   - Check each scan and request appears under the right source in `/report`.
7. Delete the test rows, or leave them, since `test` is excluded from reports.

## Kawthar page

The Kawthar campaign page (COP31 launch, reusable bottles for UK mosques this Ramadan) lives at `/kawthar`, separate from the connect page at `/`. It was ported from the comms team's skin (handover dated 5 November 2026) and has three forms in a modal:

| Form | Person receives | Team receives |
|---|---|---|
| Mosque bottle application | A copy of their application. Applications are reviewed, so there's no guaranteed allocation. | Notification with every answer |
| Support offer | A copy of their offer. No payment and no binding pledge. | Notification with every answer |
| Digital adhkar book | The Adhkar book email (same book as the connect page) | Notification |

- Validation rules live once, in `kawthar/assets/forms.js`. The page applies them as people type and before the review step, with an error summary and inline messages. `api/kawthar.js` applies the same rules again.
- Every valid submission is stored in `kawthar_submissions`: the answers as JSON, the marketing choice, the exact checkbox wording and `KAWTHAR_CONSENT_VERSION`, the source, the device and the email status. A failed email never loses the submission.
  - `sent`: both emails went.
  - `partial`: one email failed. See `email_error`.
  - `failed`: neither email went.
  - `duplicate`: same form and address within 10 minutes. Not re-sent.
- Team notifications go to `KAWTHAR_NOTIFY_TO` (default `info@adamfoundation.com`), with Reply-To set to the visitor.
- A hidden honeypot field (`nickname`) catches simple bots.
- `?src=<code>` on the page is stored as the source (default `kawthar`). `?src=test` marks a submission as a test.
- If you change the marketing checkbox wording (`UPDATES_LABEL` in `forms.js`), bump `KAWTHAR_CONSENT_VERSION` in `api/_lib/consent.js`.
- Kawthar submissions are not in `/report` or the weekly CSV yet.

## Design notes

The layout is mobile first, with a maximum content width of 510px. The palette is white `#ffffff`, navy `#061238`, blue `#0055b8` / `#0055a7` and gold `#ad8c60`. These are implementation colours matched to the brochure, not a certified brand palette. Logos are raster extracts from the supplied brochure. If master SVGs or high-resolution transparent PNGs become available, swap them in without redrawing or recolouring.

All external links open in a new tab with `rel="noopener noreferrer"`. The WhatsApp button and QR image both go to https://whatsapp.com/channel/0029Vb9M7AwG8l59M3Nk3L3J (corrected 2 November 2026; the earlier link did not open the channel). The QR image is generated from this link and was decoded to confirm it matches.
