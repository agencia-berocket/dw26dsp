# SEO Report — drumwave-site-2026 (item 6)

Scope: technical/on-page SEO for the 7 production pages, ahead of publishing on
`https://drumwave.com/`. Only `<head>` metadata, structured data, and two new
root files (`robots.txt`, `sitemap.xml`) were touched. No visual, layout, CSS,
or UX changes were made anywhere.

## What was found (before)

- No `robots.txt`, no `sitemap.xml` anywhere in the project.
- No Open Graph or Twitter Card tags on any page — link previews on
  LinkedIn/Slack/WhatsApp/X had no custom title, description, or image.
- No `meta name="robots"` anywhere (not harmful, just undeclared).
- `privacy-policy.html` (EN) and `politica-de-privacidade.html` (PT-BR) are
  real translations of each other, but had no `hreflang` link between them —
  Google had no signal they're language variants of the same page.
- Titles were short (19–64 chars; ideal ~50–60) and descriptions very short
  (56–102 chars; ideal ~140–160), wasting available SERP snippet space.
- `google-site-verification` meta tag was already present (reused from the
  old Webflow site) on all 7 pages — kept as-is per decision below.
- `Organization` + `BreadcrumbList` JSON-LD already existed on all 7 pages,
  but `Organization.logo` pointed at `dwallet-wordmark.png` (a wide wordmark,
  ~4.3:1), which is a poor fit for Google's Knowledge Panel / rich result
  logo requirements (should be close to square).
- `resources/post.html` (individual post reader): the static `<title>`,
  meta description, canonical, and JSON-LD were **identical for every post**
  (no `?slug=` in canonical), and were only ever partially overwritten by JS
  (`document.title` only) — every published article declared itself as a
  duplicate of every other one, and had no `Article`/`BlogPosting` schema.
- `business_original.html` (dead file, not linked from anywhere, not in git)
  had no canonical/OG/JSON-LD/favicons and 3 dead `href="#"` links — removed
  by the cleanup workstream (item 1/2), not by this one.

## What was implemented

Applied consistently across `index.html`, `business.html`, `contact.html`,
`resources.html`, `resources/post.html`, `privacy-policy.html`, and
`politica-de-privacidade.html`:

1. **Titles & descriptions** rewritten within recommended length (titles
   ~42–57 visible chars; descriptions ~127–191 visible chars), keeping each
   page's actual value proposition instead of the previous placeholder-style
   copy.
2. **`meta name="robots" content="index, follow"`** added explicitly on every
   real page.
3. **Open Graph** (`og:type`, `og:site_name`, `og:title`, `og:description`,
   `og:url`, `og:image` + width/height/alt, `og:locale`) and **Twitter Card**
   (`summary_large_image` for pages with a real photo, `summary` for
   text/utility pages) added to every page, using images already in active
   use elsewhere on the site (no new or orphaned images introduced):
   - Home → `assets/img/website_hero_image_1.jpg` (1916×990)
   - Business → `assets/img/sept8-run-01.png` (1920×1080)
   - Contact / Resources / Privacy (EN+PT) → `assets/img/android-chrome-512x512.png`
     (512×512, square logo fallback)
   - Individual posts → the post's own `image` field from `resources.json`,
     falling back to the square logo if missing/unsafe.
4. **`hreflang`** added between `privacy-policy.html` (en) and
   `politica-de-privacidade.html` (pt-BR), each pointing to the other plus
   itself, with `x-default` → the English version (confirmed with the
   folder/file-organization agent that these are true language variants, not
   duplicate content — so `hreflang`, not a cross-canonical, was the correct
   fix).
5. **JSON-LD additions** (kept the existing `Organization` + `BreadcrumbList`
   blocks, fixed `logo` to point at the square `assets/img/logo.png` instead
   of the wide wordmark):
   - `WebSite` on the home page.
   - `CollectionPage` on `resources.html`.
   - Dynamic `Article` schema on `resources/post.html`, populated by JS from
     the loaded post (headline, image, datePublished, publisher).
6. **`resources/post.html` dynamic SEO fix** (the most structurally important
   change): once a post loads, JS now also updates, per-post:
   - `document.title`
   - `<link rel="canonical">` → `https://drumwave.com/resources/post.html?slug=<slug>`
   - `og:title`, `og:description`, `og:url`, `og:image`, `og:image:alt`
   - `twitter:title`, `twitter:description`, `twitter:image`
   - the `Article` JSON-LD block

   This removes the duplicate-content problem where all ~29 posts shared one
   canonical/title/description. On an unknown/missing `slug` (404 case), the
   page now also sets `<meta name="robots" content="noindex, follow">`
   dynamically, so the not-found state isn't indexable.
7. **`robots.txt`** created at the project root: allows all crawling, points
   to the sitemap.
8. **`sitemap.xml`** created at the project root: the 6 static pages plus one
   `<url>` per post from `assets/data/resources.json` (35 URLs total),
   `lastmod` from each post's `date_iso` where available.

## Decisions made with the user (Guilherme)

- Reused the existing `google-site-verification` tag rather than waiting for
  a new Search Console property, per explicit confirmation.
- `Organization.sameAs` kept to LinkedIn + YouTube only (dropped Facebook/X,
  which were in the old Webflow site's JSON-LD but are not represented by any
  icon/link on the current site), per explicit confirmation.

## Known limitation not fixed here (flagged, not resolved)

- `resources.html` and `resources/post.html` render their real content
  (post list / article body) entirely client-side via `fetch()` +
  `innerHTML`. The static HTML has only a thin shell (~60–74 words). Most
  crawlers today do execute JS and will see the real content, but this is
  still a structural SEO risk (slower indexing, fragile to fetch
  timeouts/errors, no content for crawlers that don't render JS). Fixing this
  properly means pre-rendering/SSG'ing the resources content at build time —
  that's an architecture change beyond "fix the `<head>`", would touch the
  same files as the code-organization workstream (item 3), and risks visual/
  behavioral changes the user explicitly asked to avoid. Recommended as a
  follow-up, not attempted in this pass.
- Page load performance / Core Web Vitals (render-blocking CSS/JS, image
  compression, etc.) is a joint SEO ranking factor but was left to the
  code-organization workstream (item 3), which owns `<body>`/CSS/JS — this
  report only confirms no new performance regressions were introduced by the
  `<head>` additions (all added tags are `<meta>`/`<link>`, no extra blocking
  scripts).

## Verification performed

- Every JSON-LD block on every page re-validated as parseable JSON after all
  edits.
- Local static server + Playwright smoke test on all 7 pages plus a valid
  and an invalid post slug: confirmed correct `<title>`, canonical, and
  `og:title`/`og:image` per page, dynamic values update correctly on
  `resources/post.html` for both the valid-post and not-found cases, and no
  new console errors were introduced.
- Screenshots of home and a post page confirm no visual/layout changes.
- `sitemap.xml` parses as valid XML with 35 `<url>` entries.

## Coordination notes

Worked alongside 5 other agents on this repo in parallel (file cleanup,
folder/README reorganization, HTML/CSS/JS code audit, contact form/HubSpot,
analytics/tracking inventory). Confirmed before implementing:
- Final production URLs stay as flat `.html` files at the current paths (no
  slug/router restructuring) — sitemap and canonicals are based on that.
- No image used for `og:image` here is on the orphaned-image deletion list
  from the cleanup workstream.
- `business_original.html` is dead and out of scope for SEO.
