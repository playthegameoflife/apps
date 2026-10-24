#!/usr/bin/env python3
"""QA the rebuilt prompt library page: layout at multiple widths, console
errors, failed requests, and the core interactions (category filter, search,
drawer open/close, use-in-generator handoff)."""
import json
import sys
from playwright.sync_api import sync_playwright

BASE = __import__('os').environ.get('QA_BASE','http://127.0.0.1:8082')
PAGES = [
    ('library', '/library.html'),
    ('home', '/'),
]


def run():
    failures = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path='/usr/bin/google-chrome',
            args=['--no-sandbox', '--disable-dev-shm-usage'])
        for name, path in PAGES:
            for w, h in [(390, 844), (768, 1024), (1280, 900), (1600, 1000)]:
                ctx = browser.new_context(viewport={'width': w, 'height': h})
                page = ctx.new_page()
                errors, bad_requests = [], []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.on('console', lambda m: errors.append('console: ' + m.text)
                        if m.type == 'error' else None)
                page.on('response', lambda r: bad_requests.append((r.status, r.url))
                        if r.status >= 400 else None)
                page.goto(BASE + path, wait_until='networkidle')
                page.wait_for_timeout(1200)

                metrics = page.evaluate("""() => {
                  const de = document.documentElement;
                  const overflowX = de.scrollWidth > de.clientWidth;
                  const wide = [];
                  document.querySelectorAll('body *').forEach(el => {
                    const r = el.getBoundingClientRect();
                    if (r.width > 0 && r.right > de.clientWidth + 2) {
                      wide.push(el.tagName + '.' + (el.className||'').toString().split(' ')[0]
                                + ' right=' + Math.round(r.right));
                    }
                  });
                  return {overflowX, scrollW: de.scrollWidth, clientW: de.clientWidth,
                          offenders: wide.slice(0, 6)};
                }""")
                if metrics['overflowX']:
                    failures.append('%s @%dpx horizontal overflow: %s' %
                                    (name, w, metrics['offenders']))
                for e in errors:
                    failures.append('%s @%dpx JS error: %s' % (name, w, e[:160]))
                for s, u in bad_requests:
                    failures.append('%s @%dpx HTTP %s %s' % (name, w, s, u))
                ctx.close()

        # ---- interaction test on the library page ----
        ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
        page = ctx.new_page()
        page.goto(BASE + '/library.html', wait_until='networkidle')
        page.wait_for_timeout(800)

        def check(label, cond, detail=''):
            if not cond:
                failures.append('interaction: ' + label + ' ' + detail)

        total = page.evaluate('LIB_ITEMS.length')
        check('index has 2140 items', total == 2140, 'got %s' % total)

        count_txt = page.inner_text('#lib-count')
        check('count shows all prompts', '2,140' in count_txt, repr(count_txt))

        # category filter scopes results
        page.click('.lib-rail-item[data-cat="legal"]')
        page.wait_for_timeout(300)
        n = page.evaluate("document.querySelectorAll('.lib-pcard').length")
        check('legal filter returns 4 cards', n == 4, 'got %s' % n)
        check('legal count text', '4 of 2,140' in page.inner_text('#lib-count'),
              repr(page.inner_text('#lib-count')))

        # back to all
        page.click('.lib-rail-item[data-cat="all"]')
        page.wait_for_timeout(300)

        # search matches body text, not just names
        page.fill('#lib-search', 'midjourney')
        page.wait_for_timeout(2500)
        n = page.evaluate("document.querySelectorAll('.lib-pcard').length")
        check('body-text search finds >1 result', n > 1, 'got %s' % n)

        # search with no match
        page.fill('#lib-search', 'zzzzqqqqxxxx')
        page.wait_for_timeout(1200)
        check('empty state shown', page.evaluate(
            "!!document.querySelector('.lib-empty')"))

        page.fill('#lib-search', '')
        page.wait_for_timeout(400)

        # drawer opens with the real prompt body
        page.click('.lib-pcard')
        page.wait_for_timeout(1200)
        check('drawer open', page.evaluate(
            "document.getElementById('lib-drawer').classList.contains('open')"))
        body_len = page.evaluate(
            "document.getElementById('lib-drawer-text').textContent.length")
        check('drawer has prompt body', body_len > 100, 'len %s' % body_len)
        check('drawer body not loading placeholder',
              page.inner_text('#lib-drawer-text').strip() != 'Loading…')

        # close with Escape
        page.keyboard.press('Escape')
        page.wait_for_timeout(400)
        check('escape closes drawer', not page.evaluate(
            "document.getElementById('lib-drawer').classList.contains('open')"))

        # use-in-generator hands off a full body via localStorage.
        # The page stores under 'phg_lib_' + key and navigates to /?lib=<key>.
        page.click('.lib-pcard')
        page.wait_for_timeout(1000)
        page.evaluate("""() => {
          const b = document.getElementById('lib-drawer-text').textContent;
          localStorage.setItem('phg_lib_qa', JSON.stringify(
            {p: b, m: 'TEXT_ENHANCEMENT', s: 'detailed'}));
        }""")
        page.goto(BASE + '/?lib=qa', wait_until='networkidle')
        page.wait_for_timeout(900)
        ta = page.input_value('#prompt-input')
        check('generator received prompt body', len(ta) > 100, 'len %s' % len(ta))
        check('handoff entry consumed', page.evaluate(
            "localStorage.getItem('phg_lib_qa') === null"))

        ctx.close()
        browser.close()

    if failures:
        print('FAIL (%d)' % len(failures))
        for f in failures:
            print('  - ' + f)
        return 1
    print('PASS — all layout, console, network and interaction checks green')
    return 0


if __name__ == '__main__':
    sys.exit(run())
