#!/usr/bin/env python3
"""Root-cause the ?mode= deep-link failure, check the auth backend, and
measure the mobile library-tab overflow."""
import json
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8082'

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome',
                          args=['--no-sandbox', '--disable-dev-shm-usage'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()

    # ---- 1. is the mode-tab lookup happening before populateModes()? ----
    pg.goto(BASE + '/?mode=IMAGE', wait_until='networkidle')
    pg.wait_for_timeout(1500)
    print('--- deep link ?mode=IMAGE ---')
    print(pg.evaluate("""() => ({
      activeTab: (document.querySelector('.mode-tab.active')||{}).textContent,
      tabsPresent: document.querySelectorAll('.mode-tab').length,
      tabDataModes: [...document.querySelectorAll('.mode-tab')].map(t=>t.dataset.mode),
      styleValue: document.getElementById('style-select').value,
      styleOptions: [...document.getElementById('style-select').options].map(o=>o.value),
    })"""))

    # what shell.js sees at its own script-eval time vs DOMContentLoaded
    pg.goto(BASE + '/?mode=IMAGE', wait_until='domcontentloaded')
    print('\n--- at DOMContentLoaded ---')
    print(pg.evaluate("""() => ({
      tabsPresent: document.querySelectorAll('.mode-tab').length,
    })"""))

    # ---- 2. auth backend reachable? ----
    print('\n--- auth backend ---')
    try:
        r = pg.request.get('https://api-clyep56cdq-uc.a.run.app/health')
        print('GET /health ->', r.status, r.text()[:200])
    except Exception as e:
        print('backend request failed:', e)

    # ---- 3. does the GSI token client actually initialise? ----
    pg.goto(BASE + '/', wait_until='networkidle')
    pg.wait_for_timeout(2000)
    print('\n--- google identity ---')
    print(pg.evaluate("""() => ({
      googleGlobal: typeof window.google,
      hasAccounts: !!(window.google && window.google.accounts),
      hasOAuth2: !!(window.google && window.google.accounts && window.google.accounts.oauth2),
      gsiScript: !!document.querySelector('script[src*="gsi/client"]'),
      authMsg: (document.getElementById('auth-msg')||{}).textContent,
      userLabel: (document.getElementById('user-label')||{}).textContent,
    })"""))

    # ---- 4. mobile lib-tabs overflow measurement ----
    mctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                         has_touch=True, device_scale_factor=3)
    mpg = mctx.new_page()
    mpg.goto(BASE + '/', wait_until='networkidle')
    mpg.wait_for_timeout(1500)
    print('\n--- mobile lib-tabs ---')
    print(mpg.evaluate("""() => {
      const tabs = document.getElementById('lib-tabs');
      const cs = getComputedStyle(tabs);
      const kids = [...tabs.querySelectorAll('.lib-tab')].map(t => {
        const r = t.getBoundingClientRect();
        return {text: t.textContent.trim(), left: Math.round(r.left),
                right: Math.round(r.right), w: Math.round(r.width),
                h: Math.round(r.height)};
      });
      return {overflowX: cs.overflowX, flexWrap: cs.flexWrap,
              display: cs.display, gridAutoFlow: cs.gridAutoFlow,
              scrollW: tabs.scrollWidth, clientW: tabs.clientWidth,
              tabs: kids, lastRight: kids[kids.length-1].right};
    }"""))
    mpg.screenshot(path='/tmp/mobile-libtabs.png', full_page=False)

    # tap the 4th tab to see if it is reachable
    mpg.evaluate("document.querySelectorAll('#lib-tabs .lib-tab')[3].click()")
    mpg.wait_for_timeout(600)
    print('\nafter tapping 4th tab:',
          mpg.evaluate("""() => ({
             active: (document.querySelector('#lib-tabs .lib-tab.active')||{}).textContent,
             firstCard: (document.querySelector('#lib-grid .lib-card .lib-text')||{}).textContent,
           })"""))

    ctx.close(); mctx.close(); b.close()
