# reCAPTCHA v3 + HubSpot proxy — setup for the IT team

## Status (updated 2026-09-18)

**Deployed and verified working end-to-end, live on https://drumwave.com/.**
Steps 1–3 below are complete. This document now doubles as the setup guide
and the record of what's live.

- Site Key: `6LeqGLEtAAAAAPwGpgbsue4F0-P5M0SC3DQiTNiQ` (configured in `contact.html`)
- API Gateway Invoke URL: `https://dh3981f8v1.execute-api.us-east-1.amazonaws.com/contact-submit` (configured in `contact.html`)
- Verified via direct `curl` calls to the endpoint (before the site was published):
  - Missing reCAPTCHA token → `400 missing_recaptcha_token` ✅ (input validation working)
  - Invalid/fake token → `403 recaptcha_check_failed` ✅ (Lambda is actually calling Google's
    verification API with the configured Secret Key, and correctly rejecting it)
  - `OPTIONS` preflight from `https://drumwave.com` origin → `204` ✅ (CORS working)
- **Verified:** a real end-to-end submission (real browser-generated token) from the
  published site (`https://drumwave.com/`) was confirmed to land correctly in HubSpot.
  reCAPTCHA and the anti-spam layers are live and working as expected.

### Fallback monitoring

If the reCAPTCHA token request fails (network issue, third-party script
blocked, timeout) or `RECAPTCHA_SITE_KEY`/`RECAPTCHA_PROXY_ENDPOINT` are ever
unset, the form falls back to submitting directly to the HubSpot Forms API,
skipping bot verification entirely (only the client-side honeypot and
rate-limit remain, both easily bypassed by a script).

This fallback now fires a PostHog event, `contact_form_recaptcha_fallback`,
every time it happens (see `contact.html`, in the submit handler). To check
how often this occurs: PostHog dashboard → **Activity/Events** → filter by
event name `contact_form_recaptcha_fallback`. A near-zero rate is expected;
a sustained non-zero rate means either legitimate users are hitting it
(e.g. an ad/privacy blocker strips the reCAPTCHA script) or it's being used
to submit spam without verification — worth an alert if it becomes frequent.

### Remaining go-live checklist items

Confirmed with the site owner (2026-09-18): the site is live on
`drumwave.com`, reCAPTCHA is verified end-to-end, and the domain
configuration is correct. The items below were not part of that
confirmation and are still open — check directly in the AWS/Google
consoles.

- [x] Run the real end-to-end test once the site is published — confirmed
      working on `https://drumwave.com/` (2026-09-18).
- [ ] Confirm whether API Gateway throttling (step 4 below) was configured — unconfirmed
- [x] Confirm the domain registered in the Google reCAPTCHA admin console exactly matches
      the production domain (`drumwave.com`, and `www.drumwave.com` if that's also served) —
      confirmed by the site owner (2026-09-12).
- [x] Confirm the Lambda's `ALLOWED_ORIGIN` environment variable is updated to match the
      final production domain — confirmed correct for `https://drumwave.com` (2026-09-18).
- [ ] Consider a basic CloudWatch alarm on the Lambda's error rate, so a misconfiguration
      (e.g. expired key, miscalibrated score) doesn't fail silently
- [ ] Confirm the reCAPTCHA Secret Key and the HubSpot service key used to look up the
      subscription type id are stored in the team's secrets vault (1Password), not just
      known to whoever set them up

## Context

The contact form (`contact.html`) submits directly to the HubSpot Forms API
via `fetch` in the browser. This works, but has no real bot protection:
any script can call the public HubSpot endpoint directly, without even
loading the site.

To fix this without exposing the HubSpot API publicly and without relying
only on client-side protections (which a bot can bypass by reading the JS),
we're placing a serverless proxy on AWS between the form and HubSpot. This
proxy:

1. Receives the form data plus a reCAPTCHA v3 token generated in the browser.
2. Validates that token directly against Google's API, using a **Secret Key**
   that is never exposed on the frontend.
3. Only forwards the data to the HubSpot Forms API if Google confirms the
   submission looks human (`score >= 0.5`).

## Architecture

```
Browser (contact.html)
  → generates a reCAPTCHA v3 token (via the public Site Key)
  → POST to API Gateway (HTTPS)
      → Lambda (Node.js 20.x) — tools/lambda-recaptcha-proxy/index.mjs
          → validates the token with google.com/recaptcha/api/siteverify (uses the Secret Key)
          → if approved, POST to the HubSpot Forms API
      ← response { ok: true } or an error
  ← shows success/error on the form
```

Expected cost: essentially zero on the AWS free tier (Lambda + API Gateway
for the traffic volume of an institutional contact form).

## What's already ready in this repository

- `tools/lambda-recaptcha-proxy/index.mjs` — complete Lambda code, ready to deploy.
  No need to edit the logic, only the environment variables (below).
- The frontend (`contact.html`) is already prepared to point to the new
  endpoint as soon as it exists — see "What changes on the frontend" below.

## Step-by-step — AWS infrastructure

### 1. Generate the Google reCAPTCHA v3 keys

1. Go to https://www.google.com/recaptcha/admin/create
2. Type: **reCAPTCHA v3**
3. Domains: `drumwave.com` (plus any subdomain/staging domain in use, e.g.
   `www.drumwave.com`, a preview domain)
4. Copy the two generated keys:
   - **Site Key** (public — goes into the site's HTML)
   - **Secret Key** (private — goes ONLY into the Lambda's environment
     variable, never into the site's code)

### 2. Create the Lambda

- Runtime: **Node.js 20.x**
- Handler: `index.handler`
- Code: contents of `tools/lambda-recaptcha-proxy/index.mjs` from this repository
  (package as a .zip or deploy via IaC — see the IaC section below)
- Timeout: 10s is enough (the function makes 2 outbound HTTP calls in series)
- Memory: 128 MB is enough

**Lambda environment variables:**

| Name | Value | Required |
|---|---|---|
| `RECAPTCHA_SECRET_KEY` | Secret Key generated in step 1 | Yes |
| `RECAPTCHA_MIN_SCORE` | `0.5` (adjustable; 0.0 = definitely a bot, 1.0 = definitely human) | No (defaults to 0.5) |
| `ALLOWED_ORIGIN` | `https://drumwave.com` (the exact production site origin, for the CORS header) | Yes |

**IAM permissions (Lambda execution role):**
- Only the basic managed policy `AWSLambdaBasicExecutionRole` (permission to
  write logs to CloudWatch). The Lambda doesn't touch any other AWS resource —
  no S3, DynamoDB, etc. permissions needed.

### 3. Create the API Gateway

- Type: **HTTP API** (simpler and cheaper than REST API for this case)
- Route: `POST /contact-submit`
- Integration: the Lambda created in step 2 (Lambda proxy integration)
- Enable CORS on the route, allowing:
  - Origin: `https://drumwave.com` (same origin configured in `ALLOWED_ORIGIN`)
  - Methods: `POST, OPTIONS`
  - Headers: `Content-Type`
- Note down the generated **Invoke URL** (format
  `https://xxxxxxxxxx.execute-api.<region>.amazonaws.com/contact-submit`) —
  this URL goes to the frontend.

### 4. (Optional, recommended) Rate limiting on the API Gateway

For an extra layer of protection against flooding, configure throttling on
the route:
- E.g. 5 requests/second, burst of 10 — more than enough for legitimate human
  traffic on a contact form, while limiting abuse.

### IaC option (Terraform / CDK / SAM)

If the team prefers infrastructure as code instead of configuring through the
console, the resources to provision are exactly the 3 items above (Lambda,
IAM role, API Gateway HTTP API + route + integration). The Lambda code is
already ready in `tools/lambda-recaptcha-proxy/index.mjs` — it has no external
dependencies (uses the native `fetch` available in the Node 18+ runtime), so
the deployment package is just that single file, no `node_modules` needed.

## What changes on the frontend (`contact.html`)

Once the API Gateway's Invoke URL exists, the frontend needs 2 changes (the
site developer will apply these as soon as they have the URL and the Site
Key):

1. Load Google's reCAPTCHA v3 script, with the **Site Key** (public):
   ```html
   <script src="https://www.google.com/recaptcha/api.js?render=YOUR_SITE_KEY_HERE"></script>
   ```

2. On form submit, generate the token with `action: 'contact_form_submit'`
   (the same value checked in the Lambda) and send the payload to the new
   API Gateway URL instead of hitting the HubSpot API directly. The data
   shape the Lambda expects is:
   ```json
   {
     "recaptchaToken": "...",
     "contact": {
       "firstname": "...",
       "lastname": "...",
       "email": "...",
       "message_subject_line": "...",
       "message": "...",
       "how_did_you_hear_about_us_": "...",
       "marketingConsent": true,
       "hutk": "...",
       "pageUri": "...",
       "pageName": "..."
     }
   }
   ```

Security note for the IT team: the reCAPTCHA v3 visual badge (Google's little
logo in the corner of the screen) can be hidden via CSS, but in that case
Google requires the attribution text ("This site is protected by
reCAPTCHA...") to be shown somewhere visible on the page — usually near the
submit button. This is already handled in the form's HTML.

## What we needed back from the IT team

Two values, once steps 1 and 3 above were done — neither one is a secret,
they're just public identifiers:

- The **Site Key** from step 1
- The **Invoke URL** from step 3

✅ Both received and configured in `contact.html` — see "Status" at the top
of this document.

## Contacts / questions

Any adjustment to the business logic (HubSpot fields, consent text,
marketing subscription type id) is centralized at the top of
`tools/lambda-recaptcha-proxy/index.mjs`, with comments.
