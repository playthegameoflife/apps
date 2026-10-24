#!/usr/bin/env python3
"""Does the sign-in button actually open Google's flow? What does signing in
unlock for a FREE user? And does the mobile menu work?"""
import json
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8082'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome',
                          args=['--no-sandbox', '--disable-dev-shm-usage'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()

    # ---- does clicking sign-in open the Google popup? ----
    pg.goto(BASE + '/', wait_until='networkidle')
    pg.wait_for_timeout(2000)
    print('--- sign-in click (desktop) ---')
    with pg.context.expect_page(timeout=8000) as pop:
        pg.click('#signin-btn')
    popup = pop.value
    popup.wait_for_timeout(3000)
    print('popup url:', popup.url[:160])
    print('popup title:', popup.title())

    # ---- what does the FREE signed-in tier get that guest does not? ----
    print('\n--- feature availability by tier (from code) ---')
    js = open('/root/apps-webgen/generate.js', encoding='utf-8').read()
    for feat, needle in [
        ('memory notes', 'memory-input'),
        ('A/B variants', 'ab-toggle'),
        ('history length', 'history'),
        ('saved library', 'saved'),
        ('ask questions', 'ask'),
    ]:
        print(' %-16s in generate.js: %s' % (feat, needle in js))

    # ---- mobile: does the hamburger menu open the sidebar? ----
    mctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                         has_touch=True, device_scale_factor=3)
    mpg = mctx.new_page()
    mpg.goto(BASE + '/', wait_until='networkidle')
    mpg.wait_for_timeout(1500)
    print('\n--- mobile hamburger ---')
    print('before:', mpg.evaluate("""() => {
      const s=document.getElementById('sidebar');
      return {left: Math.round(s.getBoundingClientRect().left),
              open: s.classList.contains('open'),
              bodyClass: document.body.className};
    }"""))
    mpg.click('#tb-menu')
    mpg.wait_for_timeout(800)
    print('after :', mpg.evaluate("""() => {
      const s=document.getElementById('sidebar');
      return {left: Math.round(s.getBoundingClientRect().left),
              open: s.classList.contains('open'),
              bodyClass: document.body.className,
              scrim: !!document.querySelector('.sidebar-scrim,.sb-scrim,#sb-scrim')};
    }"""))

    # ---- mobile: is the generator above the fold? ----
    print('\n--- mobile fold ---')
    print(mpg.evaluate("""() => {
      const g = document.getElementById('generator');
      const r = g.getBoundingClientRect();
      const ta = document.getElementById('prompt-input').getBoundingClientRect();
      return {generatorTop: Math.round(r.top),
              inputTop: Math.round(ta.top),
              inputBottom: Math.round(ta.bottom),
              viewportH: innerHeight,
              inputAboveFold: ta.top < innerHeight};
    }"""))

    # ---- mobile: is the sidebar reachable/usable when open? ----
    mpg.screenshot(path='/tmp/mobile-menu.png', full_page=False)

    ctx.close(); mctx.close(); b.close()
