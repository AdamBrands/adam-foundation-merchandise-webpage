# Donations API (for the adamfoundation.com Donate page)

The Donate page on adamfoundation.com takes donations through Adam Foundation Connect (connect.adamfoundation.com). Connect stores the donation, records any Gift Aid declaration, opens Stripe's secure payment page, sends the receipt and the team notification once Stripe confirms the payment, and includes the donation in the team's reports.

Your page builds the form, sends the donor's answers to the API, and redirects the donor to the payment page it returns. Card details never touch your page or connect.

Base address: `https://connect.adamfoundation.com/api/donations`

## Overview

1. When the page loads, call `GET /api/donations` for the settings: whether payments are on, the amount limits, price per bottle, the fields, and the exact wording of the email-updates and Gift Aid boxes.
2. When the donor submits, call `POST /api/donations` with their answers and your page's address (`returnUrl`).
3. If the response contains `checkoutUrl`, send the browser there (`location.href = checkoutUrl`). Open it in the whole tab: Stripe's payment page won't load inside a frame.
4. Stripe sends the donor back to your page:
   - after paying: `returnUrl?donation=success&session_id=cs_…`
   - after cancelling: `returnUrl?donation=cancelled`
5. On `donation=success`, call `GET /api/donations?session_id=…` and show the thank-you message with the amount. Connect records the payment and sends the receipt on its own. Your page doesn't need to do anything for that.

## Who can call it

The API is called from the browser on these origins only:

- `https://adamfoundation.com`
- `https://www.adamfoundation.com`
- any staging or local address the Adam Foundation team adds for you (ask them, giving the exact origin, e.g. `https://staging.adamfoundation.com` or `http://localhost:8080`)

Calls from any other website get `403 origin_not_allowed`. There is no API key, so there is nothing to keep secret on the WordPress side. Send JSON with `Content-Type: application/json`; no cookies or credentials.

## `GET /api/donations`: settings

```json
{
  "ok": true,
  "payments": true,
  "testMode": false,
  "currency": "GBP",
  "amount": { "min": 1, "max": 10000 },
  "bottles": { "pencePerBottle": 200, "presets": [10, 25, 50, 100], "defaultBottles": 25 },
  "donationType": { "key": "sadaqah", "label": "Sadaqah" },
  "fields": [
    { "name": "amount", "label": "Donation", "kind": "money", "required": true, "min": 1, "max": 10000 },
    { "name": "first_name", "label": "First name", "kind": "person", "required": true, "min": 1, "max": 100 },
    "…"
  ],
  "updates": { "text": "Keep me updated by email on Kawthar and Adam Foundation’s work. …", "version": "2026-11-kawthar-audience-v1" },
  "giftAid": { "version": "2026-11-10-v1", "scope": "single_donation", "declaration": "I want to Gift Aid this donation of {amount} to …", "ratePercent": 25 }
}
```

- `payments: false` means online donations are switched off. Hide or disable the form.
- `testMode: true` means this is a test deployment taking Stripe test cards only. Show a "test mode" notice.
- `bottles`: each bottle is `pencePerBottle` (£2) from the donor. The preset buttons are 10, 25, 50 and 100 bottles (£20, £50, £100, £200), with 25 selected first. "N bottles sponsored" is `floor(amount in pence / pencePerBottle)`.
- `updates.text` and `giftAid.declaration` must appear on your page **word for word**. Connect stores this exact wording with each donation as the donor's consent and Gift Aid declaration, so if your page shows something different, the records are wrong. Replace `{amount}` with the amount formatted as `£50.00`.

## `POST /api/donations`: start a donation

Request:

```json
{
  "data": {
    "amount": "50",
    "first_name": "Aisha",
    "last_name": "Khan",
    "email": "aisha@example.com",
    "phone": "",
    "country": "United Kingdom",
    "gift_aid": true,
    "gift_aid_address_line_1": "1 High Street",
    "gift_aid_address_line_2": "",
    "gift_aid_city": "London",
    "gift_aid_region": "",
    "gift_aid_postcode": "SW1A 1AA",
    "organisation": "",
    "dedication": "",
    "message": "",
    "updates": false
  },
  "source": "website-donate",
  "returnUrl": "https://adamfoundation.com/donate/",
  "nickname": ""
}
```

| Field | Notes |
|---|---|
| `amount` | Pounds, £1 to £10,000, up to 2 decimal places (`"50"` or `"50.00"`). |
| `first_name`, `last_name`, `email`, `country` | Required. `country` is the donor's home country, typed. |
| `phone`, `organisation`, `message` | Optional. |
| `dedication` | Optional. "On behalf of" name. |
| `gift_aid` | `true` when the donor ticks the Gift Aid box. |
| `gift_aid_address_*` | Only when `gift_aid` is true (ignored otherwise). Address line 1 and town are required; the postcode is required when the home country is the UK. |
| `updates` | `true` when the donor ticks the email-updates box. Leave it unticked by default. |
| `source` | Optional. Lowercase letters, numbers and hyphens, up to 40 characters. Pass on the page's `?src=` value so campaigns and QR codes are counted. Defaults to `website-donate`. `test` marks the donation as a test. |
| `returnUrl` | Required. Your Donate page's full address. Any query or `#hash` is dropped. |
| `nickname` | Spam trap. Add a hidden text field called `nickname` that people never see or fill in (not `type="hidden"`; hide it with CSS and `tabindex="-1"`, `autocomplete="off"`) and send its value. If it's filled in, the API pretends to succeed without a `checkoutUrl` and stores nothing. |

Every donation is Sadaqah; the API sets this itself. When Gift Aid is ticked, the API records the declaration with the amount and the time. A declaration covers one donation, so if the donor changes the amount after ticking Gift Aid, untick the box so they confirm again.

Success: `200 { "ok": true, "sessionId": "cs_live_…", "checkoutUrl": "https://checkout.stripe.com/…" }`. The payment page expires after an hour. `sessionId` identifies this donation: Stripe adds the same value to the return address as `?session_id=`, and the status call takes it (see [Saving donations in WordPress](#saving-donations-in-wordpress)).

## `GET /api/donations?session_id=cs_…`: after payment

```json
{ "ok": true, "paid": true, "status": "complete", "amount": "£50.00" }
```

`paid: false` means the payment is still being processed (some bank payments take a while): say thank you and that the receipt will be emailed once it's confirmed. Connect's own Donate page words it as: "Your donation of £50.00 is being processed. We’ll email your receipt as soon as it’s confirmed." An unknown session gives `404 not_found`; show a general thank-you instead of an error, because the payment is recorded either way.

## Saving donations in WordPress

WordPress may keep its own copy of each donation. Connect stays the record of whether a donation was paid: it sends the receipt, records refunds and disputes, and is what Adam Foundation uses for Gift Aid claims.

1. **Save when the API returns `checkoutUrl`**, before redirecting the donor, with the `sessionId` from the same response and a status of `pending`. Don't save before calling the API: answers the API rejects would be stored.
2. **When the donor comes back** with `?donation=success&session_id=…`, find the record by `session_id` and update it from the status call.
3. **Donors who close the tab never come back.** To bring their records up to date, WordPress's server can call `GET /api/donations?session_id=…` itself (calls from a server, which send no `Origin` header, are accepted), for example hourly for records still `pending`:
   - `paid: true`: paid.
   - `status: "complete"` with `paid: false`: payment still processing. Check again later.
   - `status: "open"`: the donor is still on the payment page (it expires an hour after the donation started).
   - `status: "expired"`: not paid; the donor left without paying.
4. **Refunds and disputes are recorded only in connect.** The WordPress copy won't show them, so don't use it for Gift Aid claims or refund decisions.
5. **Personal data.** Each donation includes the donor's name, email, phone and, with Gift Aid, home address. In WordPress:
   - limit who can see these records to the staff who need them
   - don't add them to marketing lists unless `updates` is `true`
   - when a donor asks for their data to be deleted, delete it in WordPress and tell Adam Foundation so the connect copy is dealt with too

   Adam Foundation will make sure its privacy policy covers both copies.

## Errors

Every error is JSON: `{ "ok": false, "code": "…", "message": "…", "errors": { … } }`. `message` is written for donors and can be shown as is.

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | The body isn't valid JSON. |
| 403 | `origin_not_allowed` | Called from a website that isn't on the list. In the browser this shows as a CORS error. |
| 413 | `too_large` | The request is over 32 KB. |
| 422 | `invalid` | Some answers are wrong. `errors` maps each field name to a message (e.g. `"gift_aid_city": "Enter your town or city"`). Show each next to its field. |
| 422 | `invalid_return_url` | `returnUrl` is missing or not on an allowed website. |
| 404 | `not_found` | Status lookup for an unknown session. |
| 503 | `payments_unavailable` | Online donations are switched off. |
| 503 | `unavailable` | A temporary problem. The donor can try again; nothing was charged. |

Check the answers on your page too, so donors see mistakes as they type. The API checks everything again, and its rules decide.

## Example

```html
<form id="donate-form"> … fields named as above …
  <input name="nickname" class="visually-hidden" tabindex="-1" autocomplete="off">
</form>
<script>
const API = 'https://connect.adamfoundation.com/api/donations';
const form = document.getElementById('donate-form');
const params = new URLSearchParams(location.search);

if (params.get('donation') === 'success' && params.get('session_id')) {
  fetch(`${API}?session_id=${encodeURIComponent(params.get('session_id'))}`)
    .then((r) => r.json())
    .then((s) => showThanks(s.ok ? s.amount : null)) // your own function; also update the WordPress copy
    .catch(() => showThanks(null));
} else if (params.get('donation') === 'cancelled') {
  showMessage('Your donation was cancelled. Nothing has been charged.');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const f = new FormData(form);
  const data = Object.fromEntries([...f].filter(([k]) => k !== 'nickname'));
  data.gift_aid = f.has('gift_aid');
  data.updates = f.has('updates');
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data,
      source: params.get('src') || 'website-donate',
      returnUrl: location.origin + location.pathname,
      nickname: f.get('nickname') || '',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.checkoutUrl) {
    await saveWordPressCopy({ ...data, sessionId: body.sessionId, status: 'pending' }); // your own function
    return location.assign(body.checkoutUrl);
  }
  showErrors(body.errors || {}, body.message || 'Something went wrong. Please try again.');
});
</script>
```

## Testing

### 1. Sandbox (test payments)

Test against the sandbox first. It is a copy of the API connected to Stripe's sandbox, so no real money moves.

- **Sandbox API address:** sent to you separately. Use it in place of `https://connect.adamfoundation.com/api/donations` for every call.
- **Access key:** sent to you separately. Add it to the sandbox address on every call: `…/api/donations?x-vercel-protection-bypass=<key>`. For the status call, add it with `&`: `…/api/donations?x-vercel-protection-bypass=<key>&session_id=cs_test_…`. Keep the key out of the public page's code once you go live.
- **Your test website:** send Adam Foundation the exact address you'll test from (e.g. `https://staging.adamfoundation.com` or `http://localhost:8080`) so it can be allowed. `returnUrl` must be a page on that address.
- **Test cards:** `4242 4242 4242 4242` pays; `4000 0000 0000 9995` is declined. Any future expiry date, any 3-digit CVC, any name.
- The settings call returns `"testMode": true`, and session ids start `cs_test_`. Sandbox donations are marked as tests automatically, so you don't need `"source": "test"`.
- Receipts are emailed as normal, so use an email address you can check.

### 2. One live donation before go-live

When the sandbox works, make one real £1 donation on the live page, with `"source": "test"` so it stays out of Adam Foundation's reports and Gift Aid claims. Tell Adam Foundation its time and email address; they will confirm it and refund it in Stripe (Stripe keeps its fee, a few pence). Remove `"source": "test"` before the page goes live.
