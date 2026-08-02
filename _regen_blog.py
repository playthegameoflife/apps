#!/usr/bin/env python3
"""
Regenerate blog.html by scanning all blog-*.html files in /root/apps/.
Run after any new blog post is added to keep the listing current.
"""
import re, os, html
from pathlib import Path

APPS = Path("/root/apps")
OUT  = APPS / "blog.html"

# ── helpers ──────────────────────────────────────────────────────────────────

def meta(html_text, name):
    m = re.search(rf'<meta name="{name}" content="([^"]+)"', html_text)
    return html.unescape(m.group(1)) if m else ""

def page_title(html_text):
    m = re.search(r'<title>([^<]+)</title>', html_text)
    if m:
        return html.unescape(m.group(1))
    m = re.search(r'<meta property="og:title" content="([^"]+)"', html_text)
    return html.unescape(m.group(1)) if m else ""

def og_image(html_text):
    m = re.search(r'<meta property="og:image" content="([^"]+)"', html_text)
    return m.group(1) if m else ""

def extract_date(filename):
    # blog-2025-06-13-something.html  →  (2025,06,13)
    m = re.search(r'blog-(\d{4})-(\d{2})(\d{2})', filename.name)
    if m:
        return (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    # fallback: use file mtime
    return (0,)*3

# ── scanner ───────────────────────────────────────────────────────────────────

posts = []
for f in APPS.glob("blog-*.html"):
    text = f.read_text(encoding="utf-8", errors="ignore")
    title       = page_title(text) or f.stem
    description = meta(text, "description") or ""
    date_m      = re.search(r'<meta name="article:published_time" content="([^"]+)"', text)
    date        = date_m.group(1) if date_m else ""
    og_img      = og_image(text)

    # Category
    fname = f.name.lower()
    if "mycombat" in fname or any(k in fname for k in ["shadow-boxing","muay-thai","boxing-combination","martial-arts","mma-striking","kickboxing","judo","fight-combination","focus-mitt","free-boxing","solo-boxing","boxing-timer","personal-combo","drill","workout"]):
        category = "Martial Arts & Boxing"
    else:
        category = "AI & Prompts"

    posts.append(dict(
        title=title, description=description, date=date,
        href=f.name, og_img=og_img, category=category,
        sort_key=(extract_date(f), f.name),
    ))

# Sort newest first
posts.sort(key=lambda p: p["sort_key"], reverse=True)

# Count per category
counts = {}
for p in posts:
    counts[p["category"]] = counts.get(p["category"], 0) + 1

# ── HTML ───────────────────────────────────────────────────────────────────────

category_blocks = {
    "AI & Prompts":          [],
    "Martial Arts & Boxing":  [],
}

for p in posts:
    block = f'''
      <a class="post-card" href="{p["href"]}">
        <h3 class="post-title">{p["title"]}</h3>
        <div class="post-meta">{" ".join(p["date"].split("T")[0].split("-")) if p["date"] else ""}</div>
        <p class="post-desc">{p["description"]}</p>
      </a>'''
    category_blocks[p["category"]].append(block)

def render_category(name, items):
    if not items:
        return ""
    return f'''
    <div class="blog-category">
      <h2>{name} <span class="count">({len(items)} articles)</span></h2>
      {"".join(items)}
    </div>'''

body = "\n".join(filter(None, [
    render_category("AI & Prompts",          category_blocks["AI & Prompts"]),
    render_category("Martial Arts & Boxing",  category_blocks["Martial Arts & Boxing"]),
]))

total = len(posts)
html_out = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Blog — Prompt Helper Gemini, MyCombat & AI Tools | Gamified Living Apps</title>
  <meta name="description" content="Explore {total} expert blogs on AI prompt engineering, martial arts training apps, boxing timers, MyCombat guides, and AI art creation. Free tips & tutorials.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://gamifiedlivingapps.com/blog.html">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://gamifiedlivingapps.com/blog.html">
  <meta property="og:title" content="Blog — Gamified Living Apps">
  <meta property="og:description" content="{total} expert guides on AI prompts, martial arts training, boxing timers, and AI art. Free tutorials & tips.">
  <meta property="og:site_name" content="Gamified Living Apps">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Blog — Gamified Living Apps">
  <meta name="twitter:description" content="{total} expert guides on AI prompts, martial arts training, boxing timers, and AI art.">
  <link rel="stylesheet" type="text/css" href="style.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <style>
    .blog-header {{ text-align: center; padding: 48px 24px 32px; border-bottom: 1px solid var(--color-border); }}
    .blog-header h1 {{ font-size: 42px; font-weight: 700; margin-bottom: 12px; }}
    .blog-header p {{ color: var(--color-text-muted); font-size: 18px; max-width: 600px; margin: 0 auto; }}
    .blog-container {{ max-width: 900px; margin: 0 auto; padding: 32px 24px 64px; }}
    .blog-category {{ margin-bottom: 40px; }}
    .blog-category h2 {{ font-size: 24px; font-weight: 600; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--color-border); }}
    .blog-category .count {{ color: var(--color-text-muted); font-size: 14px; font-weight: 400; margin-left: 8px; }}
    .post-card {{ display: block; padding: 16px 0; border-bottom: 1px solid var(--color-border); text-decoration: none; transition: var(--transition); }}
    .post-card:hover {{ padding-left: 8px; }}
    .post-card:last-child {{ border-bottom: none; }}
    .post-title {{ font-size: 16px; font-weight: 500; color: var(--color-text); margin: 0 0 4px; line-height: 1.4; }}
    .post-card:hover .post-title {{ color: #2563eb; }}
    .post-meta {{ font-size: 13px; color: var(--color-text-muted); }}
    .post-desc {{ font-size: 14px; color: var(--color-text-secondary); margin: 4px 0 0; line-height: 1.5; }}
    .back-link {{ display: inline-block; margin-top: 32px; color: var(--color-text-muted); font-size: 14px; text-decoration: none; }}
    .back-link:hover {{ color: var(--color-text); }}
  </style>
</head>
<body>
  <header class="blog-header">
    <h1>Blog</h1>
    <p>Expert guides on AI prompts, martial arts training, and creative tools</p>
  </header>
  <div class="blog-container">
    {body}
    <a class="back-link" href="/">&larr; Back to Home</a>
  </div>
</body>
</html>'''

OUT.write_text(html_out, encoding="utf-8")
print(f"Wrote {OUT} — {total} posts ({counts})")
