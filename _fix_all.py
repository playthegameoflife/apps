#!/usr/bin/env python3
"""Execute all 4 cleanup tasks:
1. Extract fitness apps from homepage to /apps.html
2. Fix /blog/ 404 redirect
3. Fix 62 duplicate meta descriptions
4. Stagger blog dates
"""
import re, glob, os
from datetime import datetime, timedelta

blog_dir = "/root/apps"

# =============================================
# Task 1: Extract fitness apps to /apps.html
# =============================================
print("=" * 60)
print("TASK 1: Extract apps to /apps.html")
print("=" * 60)

with open(os.path.join(blog_dir, "index.html")) as f:
    index = f.read()

# Extract All Products + Testimonials + Case Studies sections
app_section_match = re.search(
    r'(<!-- ================================================\n\s+FEATURED APPS.*?-->\s*<section id="app-list">.*?</section>\s*)(\s*<section id="testimonials">.*?</section>\s*)(\s*<section id="case-studies">.*?</section>\s*)',
    index, re.DOTALL
)

if app_section_match:
    apps_content = (
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
        '  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '  <title>All Apps — Gamified Living Apps</title>\n'
        '  <meta name="description" content="Browse all Gamified Living Apps: FitClick, FitXtreme, Life Quest, Financial Quest, MyCombat, Combat Companion, MarketMaster, Real Estate Mastery, TaskMaster.">\n'
        '  <meta name="robots" content="index, follow">\n'
        '  <link rel="canonical" href="https://gamifiedlivingapps.com/apps.html">\n'
        '  <meta property="og:title" content="All Apps — Gamified Living Apps">\n'
        '  <meta property="og:description" content="Browse all apps from Gamified Living Apps.">\n'
        '  <link rel="stylesheet" type="text/css" href="style.css">\n'
        '  <link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">\n'
        '  <style>\n'
        '    .apps-header { text-align: center; padding: 80px 24px 32px; border-bottom: 1px solid #e8e8e8; }\n'
        '    .apps-header h1 { font-size: 36px; font-weight: 700; }\n'
        '    .apps-header p { color: #6a6a6a; max-width: 500px; margin: 8px auto 0; }\n'
        '    .back-link { display: block; text-align: center; padding: 32px; color: #6a6a6a; text-decoration: none; }\n'
        '    .back-link:hover { color: #1a1a1a; }\n'
        '  </style>\n</head>\n<body>\n'
        '  <div class="apps-header">\n'
        '    <h1>All Apps</h1>\n'
        '    <p>Browse our full collection of gamified mobile apps</p>\n'
        '  </div>\n'
    )
    
    # Add the app cards section without the FEATURED APPS comment wrapper
    app_cards = app_section_match.group(1)
    # Remove the comment wrapper
    app_cards = re.sub(
        r'<!-- ================================================\n\s+FEATURED APPS.*?-->\s*',
        '', app_cards, flags=re.DOTALL
    )
    
    testimonials = app_section_match.group(2)
    case_studies = app_section_match.group(3)
    
    apps_content += app_cards + testimonials + case_studies
    
    apps_content += (
        '  <a class="back-link" href="/">&larr; Back to Home</a>\n'
        '  <footer>\n'
        '    <p>&copy; 2023 Gamified Living Apps. All rights reserved.</p>\n'
        '  </footer>\n'
        '</body>\n</html>'
    )
    
    with open(os.path.join(blog_dir, "apps.html"), "w") as f:
        f.write(apps_content)
    print(f"✅ Written /apps.html ({len(apps_content):,} bytes)")

    # Now strip those sections from index.html + add a link to /apps.html
    # Replace the 3 sections with a compact "All Apps" link
    replacement = (
        '  <!-- ================================================\n'
        '       LINK TO ALL APPS\n'
        '       ================================================ -->\n'
        '  <section style="text-align:center;padding:48px 24px;border-top:1px solid #e8e8e8">\n'
        '    <h2 style="font-size:24px;font-weight:600;margin-bottom:12px">More from Gamified Living Apps</h2>\n'
        '    <p style="color:#6a6a6a;margin-bottom:24px">Check out our other apps — fitness, finance, martial arts, and more.</p>\n'
        '    <a href="/apps.html" style="display:inline-block;padding:12px 32px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:8px;font-weight:500">View All Apps &rarr;</a>\n'
        '  </section>\n'
    )
    
    index = index.replace(app_section_match.group(0), replacement)
    
    with open(os.path.join(blog_dir, "index.html"), "w") as f:
        f.write(index)
    print(f"✅ Homepage cleaned — apps moved to /apps.html")
else:
    print("❌ Could not find app sections in index.html")

# =============================================
# Task 2: Fix /blog/ 404 → redirect to /blog.html
# =============================================
print("\n" + "=" * 60)
print("TASK 2: /blog/ 404 redirect")
print("=" * 60)

blog_dir_path = os.path.join(blog_dir, "blog")
os.makedirs(blog_dir_path, exist_ok=True)

redirect_html = """<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Blog — Gamified Living Apps</title>
  <meta http-equiv="refresh" content="0; url=/blog.html">
  <link rel="canonical" href="https://gamifiedlivingapps.com/blog.html">
  <script>window.location.href = '/blog.html';</script>
</head>
<body>
  <p>Redirecting to <a href="/blog.html">Blog</a>...</p>
</body>
</html>"""

with open(os.path.join(blog_dir_path, "index.html"), "w") as f:
    f.write(redirect_html)
print(f"✅ Created /blog/index.html → redirects to /blog.html")

# =============================================
# Task 3: Fix 62 duplicate meta descriptions
# =============================================
print("\n" + "=" * 60)
print("TASK 3: Fix 62 duplicate meta descriptions")
print("=" * 60)

blog_files = sorted(glob.glob(os.path.join(blog_dir, "blog-*.html")))
fixed_count = 0

for path in blog_files:
    fname = os.path.basename(path)
    with open(path) as f:
        content = f.read()
    
    # Get title
    title_match = re.search(r'<title>(.*?)</title>', content)
    if not title_match:
        continue
    
    title = title_match.group(1).strip()
    # Truncate title for meta description
    meta_desc = title[:150] if len(title) <= 150 else title[:147] + '...'
    
    # Get a snippet of content for a richer description
    body_match = re.search(r'<h2>(.*?)</h2>', content)
    if body_match:
        snippet = re.sub(r'<[^>]+>', '', body_match.group(1)).strip()
        if len(snippet) > 20:
            meta_desc = f"{title[:100]}. {snippet[:60]}"
    
    meta_desc = meta_desc[:158]
    
    # Replace meta description
    old_meta = r'(<meta\s+name="description"\s+content=")[^"]*(")'
    new_meta = r'\g<1>' + meta_desc + r'\g<2>'
    
    new_content = re.sub(old_meta, new_meta, content, count=1)
    
    if new_content != content:
        with open(path, 'w') as f:
            f.write(new_content)
        fixed_count += 1

print(f"✅ Fixed {fixed_count}/{len(blog_files)} blog meta descriptions")

# =============================================
# Task 4: Stagger blog dates
# =============================================
print("\n" + "=" * 60)
print("TASK 4: Stagger blog dates")
print("=" * 60)

# Use filenames to extract dates, stagger them across the last 6 months
today = datetime.now()
staggered = 0

for i, path in enumerate(blog_files):
    fname = os.path.basename(path)
    
    # Try to extract a date from filename
    m = re.search(r'-(\d{8})\.html$', fname)
    if m:
        date_str = m.group(1)
        try:
            d = datetime.strptime(date_str, "%Y%m%d")
            # Use the actual date
        except:
            d = today - timedelta(days=len(blog_files) - i)
    else:
        # No date in filename — stagger across last 180 days
        d = today - timedelta(days=180 - i * 3)
    
    # Set file modification time
    ts = d.timestamp()
    os.utime(path, (ts, ts))
    staggered += 1

print(f"✅ Staggered {staggered} blog file timestamps")

# =============================================
# Also update sitemap with staggered dates
# =============================================
print("\n" + "=" * 60)
print("Update sitemap.xml")
print("=" * 60)

# Re-read sitemap
with open(os.path.join(blog_dir, "sitemap.xml")) as f:
    sitemap = f.read()

# Update dates for blog entries based on file timestamps
for path in blog_files:
    fname = os.path.basename(path)
    slug = fname.replace('.html', '')
    mtime = os.path.getmtime(path)
    d = datetime.fromtimestamp(mtime)
    date_str = d.strftime('%Y-%m-%d')
    
    # Update the sitemap entry for this blog
    sitemap = re.sub(
        rf'(<loc>https://gamifiedlivingapps\.com/{re.escape(fname)}</loc>\s*<lastmod>)[^<]+(</lastmod>)',
        rf'\g<1>{date_str}\g<2>',
        sitemap
    )

# Also update homepage lastmod
sitemap = re.sub(
    r'(<loc>https://gamifiedlivingapps\.com/</loc>\s*<lastmod>)[^<]+(</lastmod>)',
    rf'\g<1>{today.strftime("%Y-%m-%d")}\g<2>',
    sitemap
)

with open(os.path.join(blog_dir, "sitemap.xml"), "w") as f:
    f.write(sitemap)
print(f"✅ Sitemap dates updated")

# Add apps.html to sitemap
if '<loc>https://gamifiedlivingapps.com/apps.html</loc>' not in sitemap:
    apps_entry = f'''  <url>
    <loc>https://gamifiedlivingapps.com/apps.html</loc>
    <lastmod>{today.strftime("%Y-%m-%d")}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>'''
    sitemap = sitemap.replace('</urlset>', f'{apps_entry}\n</urlset>')
    with open(os.path.join(blog_dir, "sitemap.xml"), "w") as f:
        f.write(sitemap)
    print(f"✅ Added /apps.html to sitemap")

print("\n🎉 ALL DONE!")
