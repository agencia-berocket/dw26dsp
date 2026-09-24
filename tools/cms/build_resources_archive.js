#!/usr/bin/env node
/**
 * Generates resources/archive.html: a static, JS-free index of every entry in
 * assets/data/resources.json (title, category, date, plain-text summary, link
 * to the real post). Exists so crawlers that don't execute JavaScript — many
 * AI crawlers included — can read DrumWave's press/media history, which today
 * is invisible to them on resources.html and resources/post.html (both render
 * their content client-side via fetch()).
 *
 * Deliberately does NOT include each post's full body_html: that field can
 * contain embedded markup (iframes, figures) that resources/post.html only
 * inserts after running it through a client-side sanitizer. Reproducing that
 * safely in a static build is a separate, larger piece of work — this script
 * only ever emits plain-text fields (title, category, date_label, summary),
 * so there is nothing here that needs sanitizing.
 *
 * Run after tools/cms/build_resources_json.py, whenever resources.json changes:
 *   node tools/cms/build_resources_archive.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_PATH = path.join(ROOT, 'assets', 'data', 'resources.json');
const OUT_PATH = path.join(ROOT, 'resources', 'archive.html');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str);
}

const items = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// Newest first, matching the order resources.html renders in the browser.
items.sort((a, b) => new Date(b.date_iso || 0) - new Date(a.date_iso || 0));

const rows = items.map(item => {
  const slug = escapeAttr(item.slug);
  const title = escapeHtml(item.title);
  const category = escapeHtml(item.category);
  const dateLabel = escapeHtml(item.date_label);
  const dateIso = escapeAttr(item.date_iso || '');
  const summary = escapeHtml(item.summary);
  const href = `post.html?slug=${encodeURIComponent(item.slug)}`;
  return `      <article class="entry">
        <p class="entry-meta"><span class="entry-cat">${category}</span> &middot; <time datetime="${dateIso}">${dateLabel}</time></p>
        <h2 class="entry-title"><a href="${href}">${title}</a></h2>
        <p class="entry-summary">${summary}</p>
      </article>`;
}).join('\n');

const itemListJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": "DrumWave News, Press & Insights Archive",
  "itemListElement": items.map((item, i) => ({
    "@type": "ListItem",
    "position": i + 1,
    "url": `https://dw26dsp.berocket.com.br/resources/post.html?slug=${encodeURIComponent(item.slug)}`,
    "name": item.title,
  })),
}, null, 2);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DrumWave News, Press & Insights: Full Archive</title>
<meta name="description" content="Full, plain-text index of DrumWave's press releases, media coverage, and thought leadership — every entry, with a summary and a link to the full story.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://dw26dsp.berocket.com.br/resources/archive.html">

<meta property="og:type" content="website">
<meta property="og:site_name" content="DrumWave">
<meta property="og:title" content="DrumWave News, Press & Insights: Full Archive">
<meta property="og:description" content="Full, plain-text index of DrumWave's press releases, media coverage, and thought leadership.">
<meta property="og:url" content="https://dw26dsp.berocket.com.br/resources/archive.html">
<meta property="og:image" content="https://dw26dsp.berocket.com.br/assets/img/android-chrome-512x512.png">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="DrumWave logo">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="DrumWave News, Press & Insights: Full Archive">
<meta name="twitter:description" content="Full, plain-text index of DrumWave's press releases, media coverage, and thought leadership.">
<meta name="twitter:image" content="https://dw26dsp.berocket.com.br/assets/img/android-chrome-512x512.png">

<script type="application/ld+json">
${itemListJsonLd}
</script>
<link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="../assets/img/favicon-16x16.png">
<link rel="icon" href="../assets/img/favicon.ico">
<link rel="manifest" href="../site.webmanifest">
<style>
  :root{ --ink:#070707; --bone:#F3F2EE; --cobalt:#1F5BFF; --mute:#8A8A86; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--bone);font-family:system-ui,-apple-system,sans-serif;line-height:1.5;padding:0 20px}
  main{max-width:720px;margin:0 auto;padding:48px 0 80px}
  h1{font-size:clamp(1.6rem,4vw,2.2rem);margin:0 0 8px}
  .lede{color:var(--mute);margin:0 0 40px;max-width:60ch}
  .entry{padding:20px 0;border-top:1px solid rgba(243,242,238,.14)}
  .entry:first-of-type{border-top:none}
  .entry-meta{margin:0 0 6px;font-size:.8rem;letter-spacing:.04em;text-transform:uppercase;color:var(--mute)}
  .entry-cat{color:var(--cobalt)}
  .entry-title{margin:0 0 8px;font-size:1.15rem;line-height:1.3}
  .entry-title a{color:var(--bone);text-decoration:none}
  .entry-title a:hover{text-decoration:underline}
  .entry-summary{margin:0;color:#ccc;font-size:.95rem}
  a.back{color:var(--cobalt);font-size:.9rem;text-decoration:none}
  a.back:hover{text-decoration:underline}
</style>
</head>
<body>
<main>
  <p><a class="back" href="../resources.html">&larr; Back to Resources</a></p>
  <h1>News, Press &amp; Insights — Full Archive</h1>
  <p class="lede">Every DrumWave press release, media mention, and thought-leadership piece, listed in full — no interaction required to read it. For the browsable version with filtering, see <a class="back" href="../resources.html" style="display:inline">resources.html</a>.</p>
${rows}
</main>
</body>
</html>
`;

fs.writeFileSync(OUT_PATH, html);
console.log(`Wrote ${items.length} entries to ${path.relative(ROOT, OUT_PATH)}`);
