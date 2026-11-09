# Adam Foundation: connect page (merchandise QR landing page)

Permanent address: https://connect.adamfoundation.com/ (currently served at business.adamfoundation.com until the domain is switched).

The page is static HTML and CSS with no framework or build step. A few Vercel Functions sit beside it:

- `/q/<code>` records a QR scan.
- `/api/book-request` stores an Adhkar book request and emails the book.
- `/report` shows scans, requests and opt-ins by QR code.
- `/donate`, `/masjids`, `/bottle` and `/corporate` are the Kawthar campaign pages. `/api/kawthar` receives their forms (see [Kawthar pages](#kawthar-pages)).

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
- `donate/`, `masjids/`, `bottle/`, `corporate/`: the Kawthar pages, each an `index.html` and its own `styles.css`.
- `kawthar/assets/`: shared by the Kawthar pages. `forms.js` holds the form fields and validation rules, used by the pages and by `api/kawthar.js`. `audience.js` runs the forms, `audience.css` styles their feedback, `form-ui.js` holds browser helpers and `motion.js` runs the illustration animations.
- `api/kawthar.js`: validates and stores Kawthar form submissions, emails the person and the team, and starts Stripe Checkout for donations. Emails are built in `api/_lib/kawthar-email.js`.
- `api/stripe-webhook.js`: confirms Kawthar donations from Stripe, then sends the receipt and team notification. Stripe setup is in `api/_lib/stripe.js`.
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
| `STRIPE_SECRET_KEY` | Optional. Turns on Kawthar donations. Use a restricted key (`rk_…`) with Checkout Sessions write and PaymentIntents read. Test keys go in **Preview** only, live keys in **Production**. Mark it Sensitive. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret (`whsec_…`) of the Stripe webhook endpoint for `/api/stripe-webhook`. Needed whenever `STRIPE_SECRET_KEY` is set. Sensitive. |
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

## Kawthar pages

The Kawthar campaign (COP31 launch, reusable bottles for UK mosques this Ramadan, "Our Earth. Our Amanah.") has four pages, built from the comms team's package `Kawthar_Infographic_Alternative_Package` (8 November 2026). Each has its own colour palette:

| Page | Audience | Form (key) | Person receives |
|---|---|---|---|
| `/donate` | Donors and charities | Donation (`donation`) | Stripe receipt once paid. While payments are off: a copy of their pledge, saying nothing was charged and the team will be in touch. |
| `/masjids` | UK Masjids | Bottle application (`masjid`) | A copy of their application. Applications are reviewed, so there's no guaranteed allocation. |
| `/bottle` | People who scan the bottle QR | Adhkar book (`bottle`) | The Adhkar book email (same book as the connect page) |
| `/corporate` | Companies and organisations | Partnership enquiry (`partner`) | A copy of their enquiry |

The team gets a notification with every answer for each submission.

- The page markup is the design's, minus the reviewers' tab bar, the "preview" notes and the animation pause buttons. The pages link to each other only where the design does: Corporate links to Donate and Masjids.
- The earlier single page at `/kawthar` (5 November 2026) has been removed and that address now shows "page not found". Its stored submissions (`mosque`, `support`, `book`) stay in `kawthar_submissions`.
- Illustration animations (Donate, Masjids, Corporate) run only while on screen and the tab is visible. With "reduce motion" on, without JavaScript, or in print, the full static illustration shows instead. The animations are CSS in each page's `styles.css`; `kawthar/assets/motion.js` starts and stops them.
- Validation rules live once, in `kawthar/assets/forms.js`. The pages apply them as people type and before the review step, with an error summary and inline messages. `api/kawthar.js` applies the same rules again.
- Every valid submission is stored in `kawthar_submissions`: the answers as JSON, the marketing choice, the exact checkbox wording and its version, the source, the device and the email status. A failed email never loses the submission.
  - `sent`: both emails went.
  - `partial`: one email failed. See `email_error`.
  - `failed`: neither email went.
  - `duplicate`: same form and address within 10 minutes. Not re-sent.
- Each page keeps its design's marketing checkbox wording. The exact text (`AUDIENCE_UPDATES` in `forms.js`) is stored under `AUDIENCE_CONSENT_VERSION`. If you change the wording on a page, change it in `forms.js` to match and bump the version. The page warns in the browser console when the two differ.
- Team notifications go to `KAWTHAR_NOTIFY_TO` (default `info@adamfoundation.com`), with Reply-To set to the visitor.
- A hidden honeypot field (`nickname`) catches simple bots.
- Source: `?src=<code>` (or `?source=<code>`) is stored as the source. Without it the source is `kawthar-donate`, `kawthar-masjids`, `kawthar-bottle` or `kawthar-corporate`. `?src=test` marks a submission as a test. Set the bottle QR code's destination in the RMS portal to `https://connect.adamfoundation.com/bottle?src=<code>`. (`/q/<code>` always forwards to the connect page, so it isn't used here.)
- Social links in the organisation cards (Bottle QR and Corporate) show as a row of brand logos rather than the designs' handle rows. Each logo's label and tooltip still name the network and handle. The WhatsApp links use the verified Adam Foundation channel. The designs' "Handle / link to add" placeholders are filled where the handle is known (Adam Foundation TikTok and X) and left out otherwise.
- Kawthar submissions are not in `/report` or the weekly CSV yet.

### Donations (Stripe)

When `STRIPE_SECRET_KEY` is set, the Donate page takes a one-off donation of £1 to £10,000, with £10, £25, £50 and £100 shortcuts. Without the key, the gift is recorded as a pledge for the team to follow up.

1. The page asks `GET /api/kawthar` whether payments are on.
2. On "Continue to secure payment", `api/kawthar.js` stores the submission with `payment_status = 'pending'` and the amount, then opens a Stripe Checkout session (GBP, `submit_type: donate`, expires after an hour). The visitor pays on Stripe's hosted page. Card details never reach this site, and Apple Pay or Google Pay appear when they're enabled in the Stripe Dashboard.
3. `api/stripe-webhook.js` verifies Stripe's signature and handles these events:
   - `checkout.session.completed` and `checkout.session.async_payment_succeeded`: the row becomes `paid`, and the donor receipt and team notification go out once only.
   - `checkout.session.async_payment_failed`: the row becomes `failed`.
   - `checkout.session.expired`: the row becomes `expired`.
4. Back on `/donate?donation=success`, the page shows the amount and status. The donation is recorded by the webhook, never by this page. `?donation=cancelled` says nothing was charged and offers to try again.

Checkout sessions carry `metadata.form = donation`, and a gift made on behalf of someone also carries `on_behalf_of`. Test-mode donations are stored with `is_test = true`.

**Setting up Stripe**
1. Create a webhook endpoint in the Stripe Dashboard (Developers → Webhooks) for `https://connect.adamfoundation.com/api/stripe-webhook`, listening to the four events above. Make one in test mode for the Preview deployment as well.
2. Put the keys and signing secrets in Vercel. Test values go in Preview, live values in Production, and all are marked Sensitive. Never commit them.
3. Before going live, check that the payment methods are on in the Stripe Dashboard, and that the Foundation's public details are right: name, statement descriptor, support email and charity status.

## Design notes

The layout is mobile first, with a maximum content width of 510px. The palette is white `#ffffff`, navy `#061238`, blue `#0055b8` / `#0055a7` and gold `#ad8c60`. These are implementation colours matched to the brochure, not a certified brand palette. Logos are raster extracts from the supplied brochure. If master SVGs or high-resolution transparent PNGs become available, swap them in without redrawing or recolouring.

All external links open in a new tab with `rel="noopener noreferrer"`. The WhatsApp button and QR image both go to https://whatsapp.com/channel/0029Vb9M7AwG8l59M3Nk3L3J (corrected 2 November 2026; the earlier link did not open the channel). The QR image is generated from this link and was decoded to confirm it matches.
