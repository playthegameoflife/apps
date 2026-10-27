#!/usr/bin/env python3
"""Build search-index.json for the top-bar search dropdown.
Run after adding blog posts, landing pages, or changing the sample prompts:
    python3 tools/build_search_index.py
Library prompts are NOT included: the catalog is served by the backend per tier.
"""
import re, json, html, os, urllib.parse
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
items, seen = [], set()
def add(kind, title, url, desc=''):
    title = html.unescape(re.sub(r'\s+', ' ', title)).strip()
    if title and url not in seen:
        seen.add(url); items.append({'k': kind, 't': title, 'u': url, 'd': html.unescape(re.sub(r'\s+', ' ', desc)).strip()[:140]})

# Tools: the use-case pages and key product pages
for f, label in [('ai-image-prompt-generator.html','AI Image Prompt Generator'),('ai-video-prompt-generator.html','Video Prompt Generator'),
                 ('ai-code-prompt-generator.html','Code Prompt Generator'),('chatgpt-prompt-generator.html','ChatGPT Prompt Generator'),
                 ('claude-prompt-generator.html','Claude Prompt Generator'),('gemini-prompt-generator.html','Gemini Prompt Generator'),
                 ('ai-prompt-optimizer.html','AI Prompt Optimizer')]:
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<meta name="description" content="([^"]*)"', s)
    add('tool', label, '/' + f, m.group(1) if m else '')
add('tool', 'Prompt Library', '/library.html', 'Ready-made prompts you can load into the generator')
add('tool', 'My Generations', '/generations.html', 'Every prompt you have created')
add('tool', 'Pricing', '/pricing.html', 'Free, guest and Pro plans')

# Guides: every card on the blog index
s = open('blog.html', encoding='utf-8').read()
for m in re.finditer(r'<a class="(?:feat|post)-card" href="([^"]+)"[^>]*>(.*?)</a>', s, re.S):
    t = re.search(r'<h3 class="(?:feat|post)-title">(.*?)</h3>', m.group(2), re.S)
    d = re.search(r'<p class="(?:feat|post)-desc">(.*?)</p>', m.group(2), re.S)
    if t: add('guide', re.sub(r'<[^>]+>', '', t.group(1)), '/' + m.group(1), re.sub(r'<[^>]+>', '', d.group(1)) if d else '')

# Sample prompts shown on the homepage
js = open('shell.js', encoding='utf-8').read()
modes = {'Text': 'TEXT', 'Code': 'CODE', 'Image': 'IMAGE', 'Video': 'VIDEO'}
for cat, body in re.findall(r'(Text|Code|Image|Video): \[(.*?)\n    \]', js, re.S):
    for t, tag in re.findall(r"\{ t: '([^']+)', s: '([^']+)' \}", body):
        add('prompt', t, '/?mode=%s&p=%s' % (modes[cat], urllib.parse.quote(t)), tag)
json.dump(items, open('search-index.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
from collections import Counter
print(Counter(i['k'] for i in items), os.path.getsize('search-index.json'), 'bytes')
