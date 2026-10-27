#!/usr/bin/env python3
"""Pre-deploy checks. Exit code 1 if any hard failure.
  python3 tools/check.py            # links, JS parse, CSP freshness
  python3 tools/check.py --mobile   # also the phone-layout test (needs playwright)
Core pages fail the run on a broken local reference; the old blog/app pages only warn."""
import re, os, sys, glob, subprocess, hashlib, base64, threading, http.server, socketserver, functools
from urllib.parse import urlparse
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); os.chdir(ROOT)
CORE = ['index.html','pricing.html','library.html','generations.html','generate.html','blog.html','privacy.html',
        'terms.html','apps.html','auth-callback.html','ai-prompt-optimizer.html'] + glob.glob('*-prompt-generator.html')
fail, warn = [], []

# 1. Local links / assets
def exists(ref):
    p = urlparse(ref)
    if p.scheme or ref.startswith(('#','mailto:','tel:','data:','javascript:','//')): return True
    path = p.path.lstrip('/')
    return path == '' or os.path.exists(path) or os.path.exists(path + '.html')
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    for m in re.finditer(r'(?:href|src)=["\']([^"\']+)["\']', s):
        ref = m.group(1)
        if not exists(ref): (fail if f in CORE else warn).append(f'{f}: missing {ref}')

# 2. JavaScript parses
for f in glob.glob('*.js'):
    r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    if r.returncode: fail.append(f'{f}: JS syntax error\n{r.stderr.strip()[:300]}')

# 3. CSP hashes match inline scripts on core pages
for f in sorted(set(CORE)):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]*)"', s)
    if not m: fail.append(f'{f}: no CSP meta (run tools/csp.py)'); continue
    for sm in re.finditer(r'<script([^>]*)>(.*?)</script>', s, re.S):
        if 'src=' in sm.group(1) or 'ld+json' in sm.group(1) or not sm.group(2).strip(): continue
        h = "sha256-" + base64.b64encode(hashlib.sha256(sm.group(2).encode()).digest()).decode()
        if h not in m.group(1): fail.append(f'{f}: inline script changed, run python3 tools/csp.py'); break

# 4. Phone layout
if '--mobile' in sys.argv:
    from playwright.sync_api import sync_playwright
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    H = functools.partial(Q, directory=os.getcwd())
    srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    os.makedirs('check-shots', exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        for u in ['/', '/pricing.html', '/library.html', '/blog.html', '/chatgpt-prompt-generator.html']:
            pg = b.new_context(viewport={'width': 390, 'height': 800}).new_page(); errs = []
            pg.on('pageerror', lambda e, x=errs: x.append(str(e)))
            pg.goto(f'http://127.0.0.1:{port}{u}'); pg.wait_for_timeout(800)
            over = pg.evaluate('document.documentElement.scrollWidth - window.innerWidth')
            if over > 1: fail.append(f'{u}: sideways overflow of {over}px on a phone')
            if u == '/':
                bb = pg.locator('#generate-btn').bounding_box()
                if not bb: fail.append('/: Generate button missing')
                elif bb['y'] > 800: warn.append(f'/: Generate button starts at y={int(bb["y"])}, below the first phone screen')
            pg.screenshot(path='check-shots/' + (u.strip('/').replace('.html','') or 'home') + '.png')
            pg.close()
        b.close()
for w in warn[:40]: print('warn:', w)
if len(warn) > 40: print(f'warn: ...and {len(warn)-40} more')
for x in fail: print('FAIL:', x)
print(f'{len(fail)} failure(s), {len(warn)} warning(s)'); sys.exit(1 if fail else 0)
