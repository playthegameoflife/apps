#!/usr/bin/env python3
"""Regenerate the Content-Security-Policy <meta> on the core pages.
Run after editing ANY inline <script> on these pages (their SHA-256 hashes
are part of the policy):   python3 tools/csp.py
"""
import re, hashlib, base64, glob, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
PAGES = ['index.html','pricing.html','library.html','generations.html','generate.html','blog.html',
         'privacy.html','terms.html','apps.html','auth-callback.html'] + glob.glob('*-prompt-generator.html') + ['ai-prompt-optimizer.html']
G = "https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.googleadservices.com https://*.adtrafficquality.google https://*.gstatic.com"
def policy(hashes):
    return "; ".join([
      "default-src 'self'",
      "script-src 'self' " + " ".join(hashes) + " https://accounts.google.com https://www.googletagmanager.com " + G,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api-clyep56cdq-uc.a.run.app https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com " + G,
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://accounts.google.com https://checkout.stripe.com https://*.googlesyndication.com https://*.doubleclick.net https://*.google.com",
      "form-action 'self' https://checkout.stripe.com https://accounts.google.com",
      "object-src 'none'", "base-uri 'self'"])
for f in sorted(set(PAGES)):
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'\s*<meta http-equiv="Content-Security-Policy"[^>]*>', '', s)
    hs = []
    for m in re.finditer(r'<script([^>]*)>(.*?)</script>', s, re.S):
        if 'src=' in m.group(1) or 'ld+json' in m.group(1) or not m.group(2).strip(): continue
        hs.append("'sha256-%s'" % base64.b64encode(hashlib.sha256(m.group(2).encode('utf-8')).digest()).decode())
    meta = '<meta http-equiv="Content-Security-Policy" content="%s">' % policy(sorted(set(hs)))
    s = re.sub(r'(<head[^>]*>)', lambda m: m.group(1) + '\n  ' + meta, s, count=1)
    open(f, 'w', encoding='utf-8').write(s)
    print(f, len(hs), 'inline script hash(es)')
