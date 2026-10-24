#!/usr/bin/env python3
"""Extract the prompt library out of the legacy 7MB library.html into
clean data files for the new app-shell library page.

Writes:
  library-data.js   -> LIB_CATS + LIB_ITEMS (name, category, generator mode) ~180KB
  library-texts.json -> array of full prompt texts, parallel to LIB_ITEMS
"""
import json, re, os

SRC = '/root/apps-webgen/library.html'
OUT_DIR = '/root/apps-webgen'

# The legacy library page was a single 7MB HTML file with the corpus inlined.
# It has since been replaced by the app-shell version, but the corpus is still
# the source of truth. Read it from git so this script stays reproducible
# regardless of what library.html currently holds.
LEGACY_SRC = None
if os.path.exists(SRC):
    with open(SRC, encoding='utf-8', errors='ignore') as fh:
        probe = fh.read(4096)
    if 'var PROMPTS = ' not in probe:
        LEGACY_SRC = SRC
else:
    LEGACY_SRC = SRC

if LEGACY_SRC:
    import subprocess
    blob = subprocess.run(
        ['git', '-C', OUT_DIR, 'show', 'HEAD:library.html'],
        capture_output=True, check=True).stdout.decode('utf-8', 'ignore')
    print('reading legacy corpus from git HEAD:library.html')
    h = blob
else:
    h = open(SRC, encoding='utf-8', errors='ignore').read()

# ---- 1. pull the PROMPTS JSON array out of the inline script -----------------
i = h.find('var PROMPTS = ') + len('var PROMPTS = ')
depth = 0
j = i
instr = False
esc = False
while j < len(h):
    ch = h[j]
    if instr:
        if esc:
            esc = False
        elif ch == '\\':
            esc = True
        elif ch == '"':
            instr = False
    else:
        if ch == '"':
            instr = True
        elif ch == '[':
            depth += 1
        elif ch == ']':
            depth -= 1
            if depth == 0:
                break
    j += 1
prompts = json.loads(h[i:j + 1])
assert len(prompts) == 2140, len(prompts)

# ---- 2. category map comes from the data-category/data-idx card attrs ------
catmap = {int(idx): cat for cat, idx in
          re.findall(r'data-category="([^"]+)" data-idx="(\d+)"', h)}
assert len(catmap) == 2140, len(catmap)

# ---- 3. category metadata (icon + label + order) from the old pills --------
pills = re.findall(
    r'data-cat="([^"]+)"[^>]*>([^<]*?)\s*<span class="pill-count">\((\d+)\)</span>', h)
CAT_META = {
    'writing':        ('✍️', 'Writing & Content'),
    'image':          ('🎨', 'Image Generation'),
    'developer':      ('🔧', 'Developer Toolbox'),
    'research':       ('🔬', 'Research & Analysis'),
    'productivity':   ('⚡', 'Productivity & Life'),
    'other':          ('🔮', 'Miscellaneous'),
    'marketing':      ('📣', 'Marketing & SEO'),
    'entertainment':  ('🎮', 'Entertainment & Games'),
    'education':      ('📚', 'Education & Learning'),
    'finance':        ('💰', 'Finance & Investing'),
    'health':         ('🏥', 'Health & Wellness'),
    'relationships':  ('💞', 'Relationships'),
    'career':         ('💼', 'Career & Jobs'),
    'legal':          ('⚖️', 'Legal'),
    'travel':         ('✈️', 'Travel & Places'),
    'food':           ('🍳', 'Food & Cooking'),
}
ORDER = [c for c, _, _ in pills if c != 'all']
assert set(ORDER) == set(CAT_META), set(ORDER) ^ set(CAT_META)

# ---- 4. classify each prompt into a generator mode -------------------------
BASE_MODE = {
    'developer': 'CODE_ENHANCEMENT',
    'image': 'IMAGE_ENHANCEMENT',
    'entertainment': 'VIDEO_ENHANCEMENT',
}
VIDEO_HINTS = re.compile(
    r'\b(video|animate|animation|cinematic shot|camera move|b-roll|storyboard|'
    r'timelapse|shorts|tiktok|youtube)\b', re.I)
IMAGE_HINTS = re.compile(
    r'\b(midjourney|dall-?e|stable diffusion|photo|photoreal|image prompt|'
    r'illustration|render|portrait)\b', re.I)
CODE_HINTS = re.compile(
    r'\b(html|css|javascript|python|react|function|api|sql|code|program|'
    r'debug|refactor|algorithm)\b', re.I)


def classify(cat, text):
    mode = BASE_MODE.get(cat, 'TEXT_ENHANCEMENT')
    if mode == 'TEXT_ENHANCEMENT':
        # refine only for categories that are a grab-bag
        if cat in ('other', 'research', 'education', 'entertainment'):
            head = text[:400]
            if VIDEO_HINTS.search(head):
                return 'VIDEO_ENHANCEMENT'
            if IMAGE_HINTS.search(head):
                return 'IMAGE_ENHANCEMENT'
            if CODE_HINTS.search(head):
                return 'CODE_ENHANCEMENT'
    return mode


STYLE_FOR_MODE = {
    'TEXT_ENHANCEMENT': 'detailed',
    'CODE_ENHANCEMENT': 'comprehensive',
    'IMAGE_ENHANCEMENT': 'cinematic',
    'VIDEO_ENHANCEMENT': 'cinematic',
}

cats = []
items = []
texts = []
for idx, p in enumerate(prompts):
    cat = catmap.get(idx, 'other')
    name = (p.get('name') or 'Untitled prompt').strip()
    body = p.get('prompt') or ''
    mode = classify(cat, body)
    cats.append({
        'id': cat,
        'icon': CAT_META[cat][0],
        'name': CAT_META[cat][1],
        'mode': mode,
        'style': STYLE_FOR_MODE[mode],
    })
    items.append({'n': name, 'c': cat, 'm': mode})
    texts.append(body)

# ---- 5. de-duplicate category records, preserve ORDER ----------------------
seen = set()
cat_list = []
for c in cats:
    if c['id'] in seen:
        continue
    seen.add(c['id'])
    cat_list.append(c)
cat_list.sort(key=lambda c: ORDER.index(c['id']))

# ---- 6. write --------------------------------------------------------------
from collections import Counter
counts = Counter(it['c'] for it in items)
for c in cat_list:
    c['count'] = counts[c['id']]

with open(os.path.join(OUT_DIR, 'library-data.js'), 'w', encoding='utf-8') as f:
    f.write('/* Auto-generated from library.html — do not edit by hand.\n')
    f.write('   LIB_CATS : category metadata\n')
    f.write('   LIB_ITEMS: {n: name, c: category id, m: generator mode}\n')
    f.write('   Full prompt text lives in lib-texts/<category>.json (lazy-loaded). */\n')
    f.write('var LIB_CATS = ' + json.dumps(cat_list, ensure_ascii=False) + ';\n')
    f.write('var LIB_ITEMS = ' + json.dumps(items, ensure_ascii=False) + ';\n')

# Full text is ~5.5MB. Split it per category and load on demand so the
# library page ships a small initial payload instead of the whole corpus.
# Each category file holds that category's texts in LIB_ITEMS order, so the
# category record carries the offset needed to map back to the flat index.
TEXTS_DIR = os.path.join(OUT_DIR, 'lib-texts')
os.makedirs(TEXTS_DIR, exist_ok=True)
by_cat = {}
offsets = {}
for pos, (it, body) in enumerate(zip(items, texts)):
    if it['c'] not in offsets:
        offsets[it['c']] = pos
        by_cat[it['c']] = []
    by_cat[it['c']].append(body)
for cat, bodies in by_cat.items():
    with open(os.path.join(TEXTS_DIR, cat + '.json'), 'w', encoding='utf-8') as f:
        json.dump(bodies, f, ensure_ascii=False)

from collections import Counter
counts = Counter(it['c'] for it in items)
for c in cat_list:
    c['count'] = counts[c['id']]
    c['offset'] = offsets[c['id']]

for c in cat_list:
    print('  %-14s %-24s %-20s %4d  off=%d' % (
        c['id'], c['name'], c['mode'], c['count'], c['offset']))
print('categories:', len(cat_list))
print('items:', len(items), 'texts:', len(texts))
print('mode split:', Counter(it['m'] for it in items))
print('library-data.js KB:', round(os.path.getsize(
    os.path.join(OUT_DIR, 'library-data.js')) / 1024))
tot = 0
for fn in sorted(os.listdir(TEXTS_DIR)):
    tot += os.path.getsize(os.path.join(TEXTS_DIR, fn))
print('lib-texts/ total KB:', round(tot / 1024),
      '| largest:', max((round(os.path.getsize(os.path.join(TEXTS_DIR, fn)) / 1024), fn)
                         for fn in os.listdir(TEXTS_DIR)))
