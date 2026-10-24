#!/usr/bin/env python3
"""Reproduce the reported bugs:
1. Do the 'More AI tools' cards actually switch mode/style?
2. Does 'View all' go somewhere sensible?
3. Do the homepage prompt-library cards load into the generator?
4. Is sign-in wired to a real Google flow?
5. Mobile optimisation audit.
"""
import json
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:8082'


def main():
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome',
                              args=['--no-sandbox', '--disable-dev-shm-usage'])
        ctx = b.new_context(viewport={'width': 1280, 'height': 900})
        pg = ctx.new_page()

        # ---- 1. More AI tools: does clicking a card change mode/style? ----
        pg.goto(BASE + '/', wait_until='networkidle')
        pg.wait_for_timeout(1200)
        before = pg.evaluate("""() => ({
          mode: (document.querySelector('.mode-tab.active')||{}).textContent,
          style: (document.getElementById('style-select')||{}).value,
        })""")
        # click "AI Image Prompt Generator" card
        pg.click('a.tool-card[href="/?mode=IMAGE"]')
        pg.wait_for_timeout(1500)
        after = pg.evaluate("""() => ({
          url: location.search,
          mode: (document.querySelector('.mode-tab.active')||{}).textContent,
          style: (document.getElementById('style-select')||{}).value,
          input: (document.getElementById('prompt-input')||{}).value,
        })""")
        out['ai_tools_click'] = {'before': before, 'after': after}

        # ---- 2. View all target ----
        pg.goto(BASE + '/', wait_until='networkidle')
        pg.wait_for_timeout(800)
        out['view_all_href'] = pg.get_attribute('a[href="/library.html"].tool-grid ~ * , '
                                               '.shell-section-head a[href="/library.html"]',
                                               'href')
        out['view_all_count'] = pg.evaluate(
            "document.querySelectorAll('.tool-grid a.tool-card').length")

        # ---- 3. Homepage library card -> generator ----
        pg.wait_for_timeout(600)
        out['homepage_lib_cards'] = pg.evaluate(
            "document.querySelectorAll('#lib-grid .lib-card').length")
        if out['homepage_lib_cards']:
            pg.click('#lib-grid .lib-card')
            pg.wait_for_timeout(900)
            out['homepage_lib_click'] = pg.evaluate("""() => ({
              input: (document.getElementById('prompt-input')||{}).value,
              mode: (document.querySelector('.mode-tab.active')||{}).textContent,
              scrolledTo: Math.round(window.scrollY),
            })""")

        # ---- 4. sign-in wiring ----
        out['signin'] = pg.evaluate("""() => {
          const btn = document.getElementById('signin-btn');
          return {
            exists: !!btn,
            text: btn ? btn.textContent.trim() : null,
            gsiLoaded: typeof window.google !== 'undefined',
            tokenClientReady: !!document.querySelector('meta[name="google-signin-client_id"]'),
            clientIdMeta: (document.querySelector('meta[name="google-signin-client_id"]')||{}).content,
          };
        }""")

        # ---- 5. mobile audit ----
        mctx = b.new_context(viewport={'width': 390, 'height': 844},
                             is_mobile=True, has_touch=True,
                             device_scale_factor=3,
                             user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) '
                                        'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 '
                                        'Mobile/15E148 Safari/604.1')
        mpg = mctx.new_page()
        mpg.goto(BASE + '/', wait_until='networkidle')
        mpg.wait_for_timeout(1500)
        out['mobile'] = mpg.evaluate("""() => {
          const de = document.documentElement;
          const offenders = [];
          document.querySelectorAll('body *').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > de.clientWidth + 2) {
              offenders.push(el.tagName + '.' + (el.className||'').toString().split(' ')[0]
                             + ' w=' + Math.round(r.width) + ' right=' + Math.round(r.right));
            }
          });
          const gen = document.getElementById('prompt-input');
          const cs = gen ? getComputedStyle(gen) : null;
          const tabs = document.querySelectorAll('.mode-tab');
          return {
            overflowX: de.scrollWidth > de.clientWidth,
            scrollW: de.scrollWidth, clientW: de.clientWidth,
            offenders: offenders.slice(0, 8),
            inputFontSize: cs ? cs.fontSize : null,
            inputHeight: gen ? Math.round(gen.getBoundingClientRect().height) : null,
            modeTabCount: tabs.length,
            modeTabOverflow: (() => {
              const p = tabs[0] && tabs[0].parentElement;
              return p ? p.scrollWidth > p.clientWidth : null;
            })(),
            sidebarVisible: (() => {
              const s = document.getElementById('sidebar');
              if (!s) return null;
              const r = s.getBoundingClientRect();
              return { w: Math.round(r.width), left: Math.round(r.left),
                       transform: getComputedStyle(s).transform };
            })(),
            genCols: getComputedStyle(document.querySelector('.gen-layout')).gridTemplateColumns,
            toolCols: getComputedStyle(document.querySelector('.tool-grid')).gridTemplateColumns,
            libCols: getComputedStyle(document.querySelector('.lib-grid')).gridTemplateColumns,
            viewportMeta: (document.querySelector('meta[name="viewport"]')||{}).content,
          };
        }""")
        mpg.screenshot(path='/tmp/mobile-home.png', full_page=False)

        # tap target audit
        out['mobile_tap_targets'] = mpg.evaluate("""() => {
          const bad = [];
          document.querySelectorAll('a, button, select, input[type=checkbox]').forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            if (r.height < 40 || r.width < 40) {
              bad.push((el.id || el.className || el.tagName).toString().slice(0, 40)
                       + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
            }
          });
          return bad.slice(0, 15);
        }""")

        # mobile library page
        mpg.goto(BASE + '/library.html', wait_until='networkidle')
        mpg.wait_for_timeout(1500)
        out['mobile_library'] = mpg.evaluate("""() => {
          const de = document.documentElement;
          return {
            overflowX: de.scrollWidth > de.clientWidth,
            scrollW: de.scrollWidth, clientW: de.clientWidth,
            cardCols: getComputedStyle(document.getElementById('lib-cards')).gridTemplateColumns,
            railPos: getComputedStyle(document.getElementById('lib-rail')).position,
            searchFont: getComputedStyle(document.getElementById('lib-search')).fontSize,
            searchInputFont: getComputedStyle(
              document.getElementById('lib-search')).fontSize,
          };
        }""")
        mpg.screenshot(path='/tmp/mobile-library.png', full_page=False)

        ctx.close(); mctx.close(); b.close()

    print(json.dumps(out, indent=1))


if __name__ == '__main__':
    main()
