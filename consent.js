/* Prompt Helper consent manager.
   Nothing from Google Analytics or AdSense is requested until the visitor
   clicks Accept. The choice is stored in localStorage ("phg_consent") and can
   be changed any time via any [data-privacy-choices] link or
   window.PHGConsent.open(). */
(function () {
  'use strict';
  var KEY = 'phg_consent', GA = 'G-FDZR5XWWBM', ADS = 'ca-pub-9842825734923539';
  var loaded = false;

  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && (v.v === 'granted' || v.v === 'denied') ? v.v : null; }
    catch (e) { return null; }
  }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {} }

  function addScript(src, cors) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    if (cors) s.crossOrigin = 'anonymous';
    document.head.appendChild(s);
  }
  function loadThirdParty() {
    if (loaded) return; loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA);
    addScript('https://www.googletagmanager.com/gtag/js?id=' + GA);
    addScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADS, true);
  }
  function revoke() {
    // Stop future measurement; cookies already set are cleared when the
    // visitor clears site data (listed in the privacy policy).
    window['ga-disable-' + GA] = true;
    if (loaded) location.reload();
  }

  function close() { var b = document.getElementById('phg-consent'); if (b) b.remove(); }
  function choose(v) { write(v); close(); if (v === 'granted') { window['ga-disable-' + GA] = false; loadThirdParty(); } else revoke(); }

  function open() {
    if (document.getElementById('phg-consent')) return;
    var b = document.createElement('div');
    b.id = 'phg-consent'; b.className = 'phg-consent';
    b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Privacy choices');
    b.innerHTML =
      '<p><strong>Your privacy choices.</strong> We use Google Analytics to understand how the site is used and Google AdSense to show ads that keep the free tier free. ' +
      'Both may set cookies or use similar identifiers. Nothing loads unless you accept. ' +
      '<a href="/privacy.html#cookies">Learn more</a></p>' +
      '<div class="phg-consent-btns"><button type="button" data-c="denied">Reject all</button><button type="button" data-c="granted" class="primary">Accept all</button></div>';
    b.addEventListener('click', function (e) { var c = e.target && e.target.getAttribute && e.target.getAttribute('data-c'); if (c) choose(c); });
    document.body.appendChild(b);
    var first = b.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }

  function injectStyle() {
    if (document.getElementById('phg-consent-css')) return;
    var st = document.createElement('style'); st.id = 'phg-consent-css';
    st.textContent =
      '.phg-consent{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;max-width:640px;margin:0 auto;display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:14px 16px;border-radius:14px;background:#fff;color:#1a1a1a;border:1px solid rgba(0,0,0,.12);box-shadow:0 12px 40px rgba(0,0,0,.18);font:14px/1.45 Inter,system-ui,sans-serif}' +
      '.phg-consent p{margin:0;flex:1 1 280px}.phg-consent a{color:inherit;text-decoration:underline}' +
      '.phg-consent-btns{display:flex;gap:8px;flex:0 0 auto}' +
      '.phg-consent button{min-height:44px;padding:0 16px;border-radius:10px;border:1px solid rgba(0,0,0,.2);background:#fff;color:#1a1a1a;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.phg-consent button.primary{background:#1a1a1a;color:#fff;border-color:#1a1a1a}' +
      'html[data-theme=dark] .phg-consent{background:#1b1b20;color:#f2f2f5;border-color:rgba(255,255,255,.16)}' +
      'html[data-theme=dark] .phg-consent button{background:#26262c;color:#f2f2f5;border-color:rgba(255,255,255,.2)}' +
      'html[data-theme=dark] .phg-consent button.primary{background:#f2f2f5;color:#111;border-color:#f2f2f5}';
    document.head.appendChild(st);
  }

  window.PHGConsent = { open: function () { injectStyle(); open(); }, state: read };

  function init() {
    injectStyle();
    var s = read();
    if (s === 'granted') loadThirdParty();
    else if (s === null) open();
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('[data-privacy-choices]');
      if (a) { e.preventDefault(); open(); }
    });
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
