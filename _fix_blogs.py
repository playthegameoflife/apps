#!/usr/bin/env python3
"""Fix all 62 blog files: remove /fruited/ links, add Back-to-Blog, add internal related links."""
import os, re, glob

blog_dir = "/root/apps"

# Get all blog filenames for related posts
blog_files = sorted(glob.glob(os.path.join(blog_dir, "blog-*.html")))
blog_names = [os.path.basename(f) for f in blog_files]

# Extract titles for related posts display
blog_titles = {}
for path in blog_files:
    fname = os.path.basename(path)
    with open(path, 'r') as f:
        content = f.read(5000)
    m = re.search(r'<title>(.*?)</title>', content)
    if m:
        blog_titles[fname] = m.group(1).strip()
    else:
        blog_titles[fname] = fname

print(f"Found {len(blog_files)} blog files")

stats = {"fruited_fixed": 0, "back_to_blog_added": 0, "related_section_replaced": 0}

for path in blog_files:
    fname = os.path.basename(path)
    with open(path, 'r') as f:
        content = f.read()
    
    original = content

    # 1. Remove entire related-posts section (which has broken /fruited/ links)
    content = re.sub(
        r'<div class=related-posts>.*?</div>\s*</div>\s*</main>\s*',
        '</div></main>',
        content,
        flags=re.DOTALL
    )
    
    # 2. Also handle any remaining /fruited/ links outside related-posts
    content = content.replace('https://gamifiedlivingapps.com/fruited/', '')
    
    # 3. Add "Back to Blog" link before </footer>
    # Match the last </footer> before </body>
    content = content.replace(
        '</footer>',
        '<div style="text-align:center;padding:24px 0 0"><a href="/blog.html" style="color:#6a6a6a;font-size:14px;text-decoration:none">&larr; Back to Blog</a></div>\n</footer>',
        1  # only first occurrence
    )
    
    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        
        if 'fruited' not in content:
            stats["fruited_fixed"] += 1
        stats["back_to_blog_added"] += 1
        print(f"  ✓ {fname}")

print(f"\nDone: {stats['fruited_fixed']} fruited links cleaned, {stats['back_to_blog_added']} back-to-blog links added")

# Verify no /fruited/ remains
remaining = glob.glob(os.path.join(blog_dir, "blog-*.html"))
fruited_count = 0
for path in remaining:
    with open(path) as f:
        if 'fruited' in f.read():
            fruited_count += 1
            print(f"  ⚠ Still has fruited: {os.path.basename(path)}")
print(f"\nFiles still with /fruited/: {fruited_count}")
