#!/usr/bin/env python3
"""QA: the plan a signed-in visitor sees must follow their real subscription.

The bug this guards against: Pro accounts shown as "Free" because the site
(a) trusted a stale `isPro` flag saved at sign-in, or (b) read the answer the
server gives a request that carries no (or an expired) token -- a guest
answer -- as the visitor's plan.

Everything is stubbed (no real Google or Stripe): the fake backend answers
/usage-status as Pro only when the request carries a token, and the test
decides whether the account is "really" Pro on the server.

Run:  QA_BASE=http://127.0.0.1:8802 python3 tools/qa_plan_display.py
Exit code is the number of failed checks.
"""
import json
import os
import sys
import time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('QA_BASE', 'http://127.0.0.1:8802')
API = '**/api-clyep56cdq-uc.a.run.app/**'
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
        'access-control-allow-methods': '*', 'content-type': 'application/json'}

PAGES_SIDEBAR = ['library.html', 'generations.html', '']   # '' = home
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + ('  -> ' + str(detail) if detail and not ok else ''))


def new_page(browser, *, signed_in=True, token_age_min=5, stored_flag=None,
             server_pro=True, cache=None, refresh='real', log=None):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, service_workers='block')
    page = ctx.new_page()
    log = log if log is not None else {}
    log.setdefault('usage', [])
    log.setdefault('google', 0)

    page.route('**/assets.endorsely.com/**', lambda r: r.fulfill(status=200, body=''))
    for d in ('doubleclick', 'googlesyndication', 'googletagmanager', 'gstatic', 'fonts.g'):
        page.route(f'**/*{d}*/**', lambda r: r.abort())

    def google(r):
        log['google'] += 1
        r.abort()
    page.route('**://accounts.google.com/**', google)
    page.route('**://oauth2.googleapis.com/**', google)

    def api(r):
        u = r.request.url
        h = r.request.headers
        if r.request.method == 'OPTIONS':
            return r.fulfill(status=204, headers=CORS)
        authed = 'x-phg-access-token' in h
        if 'usage-status' in u:
            log['usage'].append(authed)
            tier = ('pro' if server_pro else 'free') if authed else 'guest'
            return r.fulfill(status=200, headers=CORS, body=json.dumps({
                'tier': tier, 'features': {},
                'enhancements': {'used': 1, 'limit': None if tier == 'pro' else (10 if authed else 5)}}))
        if 'subscription-status' in u:
            if not authed:
                return r.fulfill(status=401, headers=CORS, body='{}')
            return r.fulfill(status=200, headers=CORS, body=json.dumps({'active': server_pro}))
        r.fulfill(status=200, headers=CORS, body='{}')
    page.route(API, api)

    init = []
    if signed_in:
        user = {'uid': 'uid123', 'email': 't@example.com', 'displayName': 'T'}
        if stored_flag is not None:
            user['isPro'] = stored_flag
        at = int((time.time() - token_age_min * 60) * 1000)
        init.append("localStorage.setItem('phg_user',%s);" % json.dumps(json.dumps(user)))
        init.append("localStorage.setItem('phg_userId','\"uid123\"');")
        init.append("localStorage.setItem('phg_access_token',JSON.stringify({access_token:'tok',at:%d}));" % at)
        if cache is not None:
            init.append("localStorage.setItem('phg_plan',JSON.stringify({uid:'uid123',isPro:%s,at:Date.now()}));"
                        % ('true' if cache else 'false'))
    if refresh == 'works':
        # Pretend the silent re-auth succeeds: store a fresh token, resolve with it.
        init.append("""(function(){var v;Object.defineProperty(window,'PHGAuth',{configurable:true,
          get:function(){return v;},set:function(x){v=x;x.refreshAccessToken=function(){
            localStorage.setItem('phg_access_token',JSON.stringify({access_token:'tok2',at:Date.now()}));
            return Promise.resolve('tok2');};}});})();""")
    if init:
        page.add_init_script(''.join(init))
    return ctx, page, log


def note(page):
    el = page.query_selector('#sb-plan-note')
    return el.inner_text().strip() if el else None


def pill(page):
    el = page.query_selector('#plan-pill')
    return el.inner_text().strip() if el else None


def visit(browser, path, wait=2800, **kw):
    ctx, page, log = new_page(browser, **kw)
    page.goto(f'{BASE}/{path}')
    page.wait_for_timeout(wait)
    return ctx, page, log


def main():
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            browser = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])

        # S1: signed in BEFORE upgrading (stored flag false), account is Pro now.
        for path in PAGES_SIDEBAR:
            ctx, pg, _ = visit(browser, path, stored_flag=False, server_pro=True)
            check(f'S1 stale-false flag, really Pro -> sidebar says Pro [{path or "home"}]',
                  (note(pg) or '').startswith('Pro plan'), note(pg))
            ctx.close()

        # S2: stored flag true, subscription since cancelled.
        for path in PAGES_SIDEBAR:
            ctx, pg, _ = visit(browser, path, stored_flag=True, server_pro=False)
            check(f'S2 stale-true flag, really Free -> sidebar says Free [{path or "home"}]',
                  (note(pg) or '').startswith('Free plan'), note(pg))
            ctx.close()

        # S3: token expired, silent refresh fails, we knew they were Pro.
        for path in PAGES_SIDEBAR:
            ctx, pg, _ = visit(browser, path, token_age_min=70, stored_flag=True, cache=True, server_pro=True)
            n = note(pg) or ''
            check(f'S3 expired token, refresh fails, known Pro -> never "Free plan" [{path or "home"}]',
                  not n.startswith('Free plan'), n)
            if path == '':
                check('S3 home pill is not "Free"', pill(pg) != 'Free', pill(pg))
            ctx.close()

        # S4: token expired, refresh fails, nothing known about the plan.
        for path in PAGES_SIDEBAR:
            ctx, pg, _ = visit(browser, path, token_age_min=70, server_pro=True)
            n = note(pg) or ''
            check(f'S4 expired token, plan unknown -> not claimed as Free [{path or "home"}]',
                  not n.startswith('Free plan'), n)
            ctx.close()

        # S5: token expired but the silent refresh works -> verified Pro.
        for path in PAGES_SIDEBAR:
            ctx, pg, log = visit(browser, path, token_age_min=70, stored_flag=False, server_pro=True, refresh='works')
            check(f'S5 expired token, refresh works -> Pro [{path or "home"}]',
                  (note(pg) or '').startswith('Pro plan'), note(pg))
            ctx.close()

        # S6: guest and signed-in free keep their own, correct, wording.
        ctx, pg, _ = visit(browser, 'library.html', signed_in=False)
        check('S6 guest sidebar says 5/week', note(pg) == 'Free plan · 5 enhancements/week', note(pg))
        ctx.close()
        ctx, pg, _ = visit(browser, 'library.html', server_pro=False, stored_flag=False)
        check('S6 signed-in free sidebar says 10/week', note(pg) == 'Free plan · 10 enhancements/week', note(pg))
        ctx.close()

        # S7: a failed silent refresh is not retried on every request.
        # The first (failing) refresh tries each client in turn, up to ~9s in all.
        ctx, pg, log = visit(browser, '', token_age_min=70, stored_flag=True, cache=True, server_pro=True, wait=11500)
        first = log['google']
        pg.evaluate("() => PHGAuth.refreshAccessToken()")
        pg.evaluate("() => PHGAuth.refreshAccessToken()")
        pg.wait_for_timeout(1500)
        check('S7 failed refresh backs off (no new Google attempts within the cooldown)',
              log['google'] == first, f'google requests {first} -> {log["google"]}')
        ctx.close()

        # S9: the page must not sit on "Free"/defaults while a refresh is failing.
        ctx, pg, _ = visit(browser, '', token_age_min=70, cache=True, server_pro=True, wait=1500)
        check('S9 expired token + known Pro: pill shows Pro within 1.5s (init not blocked)', pill(pg) == 'Pro', pill(pg))
        ctx.close()
        ctx, pg, _ = visit(browser, '', token_age_min=70, server_pro=True, wait=1500)
        check('S9 expired token + nothing known: pill is neutral, not "Free", within 1.5s', pill(pg) not in ('Free', 'Guest'), pill(pg))
        ctx.close()

        # S8: home pill follows the server for a signed-in free user, shows Pro for Pro.
        ctx, pg, _ = visit(browser, '', server_pro=True, stored_flag=False)
        check('S8 home pill = Pro for a Pro account', pill(pg) == 'Pro', pill(pg))
        ctx.close()
        ctx, pg, _ = visit(browser, '', server_pro=False, stored_flag=True)
        check('S8 home pill = Free after cancellation', pill(pg) == 'Free', pill(pg))
        ctx.close()
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)}/{len(results)} checks passed')
    sys.exit(len(failed))


if __name__ == '__main__':
    main()
