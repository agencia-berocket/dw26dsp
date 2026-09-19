# dWallet / DrumWave — institutional website (2026)

Static, multi-page marketing site, no build step. dWallet brand
("Your life creates data"), DrumWave company.

> **Status: live in production.** The site is published at
> **https://drumwave.com/**. Content, code, SEO, analytics and the contact
> form (reCAPTCHA v3 + anti-spam) have all been reviewed and verified
> end-to-end — see [Audit reports](#audit-reports) below for the full
> record of what was checked and changed.

## For the IT team

This is a **100% static** site — plain HTML, CSS and JS, no Node, no
build, no server-side dependencies. Any static file host works
(GitHub Pages, Netlify, Vercel, Hostinger, S3, etc.).

- **Domain:** https://drumwave.com/ (already used in every canonical URL,
  sitemap and structured-data block in the codebase).
- **Build:** none. Just serve the files from the root of the repository.
- **Entry point:** [`index.html`](index.html).
- **Routes:** every page is a separate `.html` file (no router,
  no SPA) — see [What it is](#what-it-is) below.
- **`robots.txt`** and **`sitemap.xml`** are already in the repository root
  and ready to serve as-is.
- **HTTPS / www → apex redirect (or vice versa):** standard host-level
  config: force HTTPS and pick one canonical host (`drumwave.com` vs
  `www.drumwave.com`) — the codebase assumes the apex domain.

Only the folders under [`tools/`](tools/) and [`docs/`](docs/) are internal
(build helpers, setup notes, audit reports) — nothing in there is served by
the site. Everything else in the repository root is published as-is.

## What it is

Institutional website for dWallet/DrumWave, with:

- **Home** ([`index.html`](index.html)) — scroll-driven brand experience,
  with animated acts and an interactive life timeline (age 18 → 70),
  showing how personal data accumulates value over a lifetime.
- **Business** ([`business.html`](business.html)) — page aimed at
  companies/partners, presenting the product from a B2B perspective.
- **Contact** ([`contact.html`](contact.html)) — contact page, with a
  form that submits to HubSpot (see [Contact form](#contact-form) below).
- **Resources** ([`resources.html`](resources.html) +
  [`resources/post.html`](resources/post.html)) — listing and reader for
  posts (news, press, institutional content), powered by
  [`assets/data/resources.json`](assets/data/resources.json).
  [`resources/archive.html`](resources/archive.html) is a static,
  JavaScript-free index of the same posts (title, category, date, summary,
  link to the full post) — see
  [Resources content (CMS)](#resources-content-cms) below.
- **Privacy Policy** ([`privacy-policy.html`](privacy-policy.html), EN) — main privacy policy page.

All pages share the same nav/footer pattern and link to each other.

## Repository structure

```
index.html                     Home — scroll experience + timeline
business.html                  Business page (B2B)
contact.html                   Contact page (HubSpot form)
resources.html                 Resources/posts listing
resources/post.html            Individual post reader (?slug=...)
privacy-policy.html            Privacy policy (EN)
politica-de-privacidade.html   Privacy policy (PT-BR / LGPD - unlinked & noindex)

robots.txt                     Crawler rules, points to sitemap.xml
sitemap.xml                    Full URL list for search engines
llms.txt                       Plain-text company/site summary for AI
                               crawlers and assistants (llmstxt.org
                               convention)
site.webmanifest               PWA manifest (icons, theme color)

assets/
  img/                   Site images (photos, icons, logo) — every file
                         here is referenced by at least one page; nothing
                         unused is committed (see docs/reports/).
  css/                   cookiescript-custom.css (consent banner theming)
  js/                    GSAP + ScrollTrigger (bundled locally),
                         analytics.js (consent-gated GA4/Ads/PostHog/
                         Contentsquare loader), cookiescript.js,
                         purify.min.js (DOMPurify, sanitizes CMS post
                         HTML in resources/post.html)
  data/resources.json    Resources post data (generated via tools/cms/)

tools/                   Internal build/ops helpers — not part of the
                         published site, nothing here is linked from any
                         page.
  cms/
    build_resources_json.py   Converts a Webflow CSV export into
                              assets/data/resources.json
    build_resources_archive.js Generates resources/archive.html (static,
                              JS-free index) from assets/data/resources.json
    *.csv                      Raw export from the old CMS (Webflow)
  lambda-recaptcha-proxy/
    index.mjs                  AWS Lambda that validates reCAPTCHA v3
                               tokens and forwards the contact form to
                               HubSpot. Deployed and verified — see
                               docs/CONTACT_FORM_SECURITY.md.

docs/                    Reference material for the IT/dev team — not
                         part of the published site.
  CONTACT_FORM_SECURITY.md   AWS setup for the reCAPTCHA proxy and
                             current deployment status.
  legacy-reference/          Snippets from the previous site (Webflow)
                             kept as historical reference only (old
                             analytics/HubSpot newsletter form). Not
                             loaded by any current page — see
                             docs/legacy-reference/README.md before
                             reusing anything from it.
  reports/                    Audit reports from the pre-launch review
                             pass — see Audit reports below.

Figma/                  Design reference (NOT part of the published site
                         — it's in .gitignore, exists locally only)
```

## Running locally

Just open `index.html` in the browser — no server needed.

- GSAP, ScrollTrigger and DOMPurify are already bundled in `assets/js/`, so
  the animation and post-page sanitization work offline.
- Fonts (Titillium Web + Open Sans) come from Google Fonts and fall back
  to the system default font if offline.
- All site images are committed directly in `assets/img/` — no download
  step required.

## Contact form

`contact.html` submits to HubSpot through an AWS proxy (API Gateway + Lambda,
[`tools/lambda-recaptcha-proxy/index.mjs`](tools/lambda-recaptcha-proxy/index.mjs))
that verifies a reCAPTCHA v3 token server-side before forwarding the
submission to the HubSpot Forms API. It also has several client-side
anti-spam layers: a honeypot field, a submit cooldown, and a
disposable-email domain block.

**Status: deployed and verified working**, including a real end-to-end
submission test from the published site confirming the contact reaches
HubSpot. See [`docs/CONTACT_FORM_SECURITY.md`](docs/CONTACT_FORM_SECURITY.md)
for the full setup details and current deployment status, and
[`docs/reports/SECURITY_AUDIT.md`](docs/reports/SECURITY_AUDIT.md) for the
latest full security audit (form/Lambda, XSS, headers, secrets, dependencies).

## Resources content (CMS)

`assets/data/resources.json` is generated from a CSV export of the old
Webflow site:

```bash
cd tools/cms
python3 build_resources_json.py
```

This reads the most recent CSV in the folder and rewrites
`assets/data/resources.json`. Run it again whenever the CMS export is
updated. Today this is a manual process — there's no automatic
integration with any CMS.

`resources/archive.html` — a static, JavaScript-free index of the same
posts (title, category, date, plain-text summary, link to the full post,
`ItemList` JSON-LD) — is generated from `assets/data/resources.json` by a
second script:

```bash
node tools/cms/build_resources_archive.js
```

Run it after `build_resources_json.py`, whenever `resources.json` changes.
It only reads `title`, `category`, `date_label`, `date_iso` and `summary`
(all plain text) — it does not render each post's `body_html`, which is
only ever inserted client-side in `resources/post.html`, after sanitization
via DOMPurify.

## Analytics, ads & consent

The site loads GA4, Google Ads, PostHog and a Cookie Script consent banner
through `assets/js/analytics.js` and `assets/js/cookiescript.js`. For the
full, current inventory of every tracking script, tag ID and consent
behavior in place, see
[`docs/reports/TRACKING_AUDIT.md`](docs/reports/TRACKING_AUDIT.md).

## SEO

`robots.txt`, `sitemap.xml` (including every individual resource post and
`resources/archive.html`), canonical URLs, `hreflang` (EN/PT-BR) between
the two privacy policy pages, Open Graph, Twitter Card and JSON-LD
structured data (Organization, WebSite, BreadcrumbList, CollectionPage,
`FAQPage` on the Home and Business pages, dynamic Article on each post,
`ItemList` on the resources archive) are in place across all pages. See
[`docs/reports/SEO_REPORT.md`](docs/reports/SEO_REPORT.md) for the full
audit.

`llms.txt`, at the repository root, gives AI crawlers and assistants a
plain-text summary of the company, its main pages and its legal entities
(the `llmstxt.org` convention) — update it whenever a main page's URL,
title or description changes.

## Audit reports

Before launch, this repository went through a full review pass, split
across focus areas. Each area's findings are documented independently in
[`docs/reports/`](docs/reports/):

- **Obsolete file cleanup** — [`CLEANUP_REPORT.md`](docs/reports/CLEANUP_REPORT.md)
- **Code audit (HTML/CSS/JS structure)** — [`CODE_AUDIT.md`](docs/reports/CODE_AUDIT.md)
- **Tracking / analytics inventory** — [`TRACKING_AUDIT.md`](docs/reports/TRACKING_AUDIT.md)
- **SEO** — [`SEO_REPORT.md`](docs/reports/SEO_REPORT.md)

## What's missing / next steps

- **Newsletter signup** — the "Join Newsletter" footer link is a
  placeholder (`#`) on every page; no signup flow exists yet.
- **General content and copy review** — text, images and pages may still
  go through adjustments after launch.
- Reference design in `Figma/` is still being used as the source of
  truth for pending visual adjustments (local folder only, outside git).

Any changes made from here on should be treated as iteration on this
base — not as a rework from scratch.
