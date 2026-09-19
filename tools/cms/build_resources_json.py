#!/usr/bin/env python3
"""Converts the Webflow CMS export into assets/data/resources.json.
Run once from this folder: python3 build_resources_json.py
Re-run any time the CSV export is refreshed."""
import csv
import json
import re
from datetime import datetime
from html import unescape
from pathlib import Path

TAG_RE = re.compile(r"<[^>]+>")

def fallback_summary(body_html, limit=160):
    text = unescape(TAG_RE.sub(" ", body_html))
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0] + "…"

CSV_PATH = Path(__file__).parent / "Drumwave_Update_2025 - Resources - 68111b97749e2a3b30a5a687.csv"
OUT_PATH = Path(__file__).parent.parent.parent / "assets" / "data" / "resources.json"

DATE_FORMATS = [
    "%B %d, %Y",   # December 18, 2024
    "%b %d, %Y",   # Oct 23, 2025
]

def parse_date(raw):
    raw = raw.strip()
    if not raw:
        return None, raw
    # Handle odd ranges like "Oct 27-19, 2025" -> keep raw label, use first day for sort
    m = re.match(r"^([A-Za-z]+)\s+(\d+)(?:-\d+)?,\s*(\d{4})$", raw)
    if m:
        month, day, year = m.groups()
        for fmt in ("%B %d %Y", "%b %d %Y"):
            try:
                dt = datetime.strptime(f"{month} {day} {year}", fmt)
                return dt.strftime("%Y-%m-%d"), raw
            except ValueError:
                continue
    for fmt in DATE_FORMATS:
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d"), raw
        except ValueError:
            continue
    return None, raw

def main():
    with open(CSV_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    items = []
    for r in rows:
        if r["Draft"].strip().lower() == "true":
            continue
        if r["Archived"].strip().lower() == "true":
            continue

        iso_date, label = parse_date(r["Data de Publicação"])
        image = r["Main Image"].strip() or r["Thumbnail image"].strip()
        body_html = r["Post Body"].strip()
        summary = r["Post Summary"].strip() or fallback_summary(body_html)

        items.append({
            "slug": r["Slug"].strip(),
            "title": r["Name"].strip(),
            "category": r["Categories"].strip(),
            "date_iso": iso_date,
            "date_label": label,
            "summary": summary,
            "body_html": body_html,
            "image": image,
            "featured": r["Featured?"].strip().lower() == "true",
        })

    # Sort newest first; items without a parseable date sink to the bottom, keep original order among ties
    items.sort(key=lambda x: (x["date_iso"] or "0000-00-00"), reverse=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(items)} items to {OUT_PATH}")

if __name__ == "__main__":
    main()
