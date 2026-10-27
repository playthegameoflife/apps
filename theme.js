/* ============================================================
   theme.js — sitewide light/dark theme for Prompt Helper
   ------------------------------------------------------------
   WHY THIS FILE EXISTS
   --------------------
   Before this, only two pages (index.html and library.html) had a
   theme toggle, because the toggle lived inside shell.js which
   only those two pages load. The pricing, legal and blog pages
   had no way to switch theme at all, and they had no dark-mode
   tokens either, so they rendered with the light palette no
   matter what the visitor preferred.

   This module is deliberately standalone: it has no dependencies
   and can be included by ANY page. It does three things:

     1. Applies the stored theme BEFORE first paint, so a dark-mode
        visitor never sees a white flash.
     2. Provides a toggle button that can be mounted anywhere.
     3. Keeps the theme in sync across tabs via the `storage` event.

   The inline bootstrap in the <head> is a separate copy of step 1
   so it can run synchronously before paint. Keep the two in sync.

   The stored key is `phg_theme`, which is what shell.js and
   post-theme.js already use, so the whole site shares one choice.
   ============================================================ */

(function () {
  'use strict';

  var THEME_KEY = 'phg_theme';
  var LIGHT = 'light';
  var DARK = 'dark';

  function stored() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      return (t === LIGHT || t === DARK) ? t : null;
    } catch (e) { return null; }
  }

  function preferred() {
    if (stored()) return stored();
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return DARK;
      }
    } catch (e) {}
    return LIGHT;
  }

  function current() {
    return document.documentElement.getAttribute('data-theme') || LIGHT;
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === DARK ? '#131312' : '#F7F5F2');
    // Keep every mounted toggle button in sync.
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.textContent = theme === DARK ? '☀' : '☾';
      b.setAttribute('aria-label', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
      b.setAttribute('title', theme === DARK ? 'Switch to light mode' : 'Switch to dark mode');
      b.setAttribute('aria-pressed', theme === DARK ? 'true' : 'false');
    }
    document.dispatchEvent(new CustomEvent('phg:themechange', { detail: { theme: theme } }));
  }

  function toggle() {
    apply(current() === DARK ? LIGHT : DARK);
  }

  /* ---------- MOUNT THE BUTTON ---------- */
  /**
   * @param {string} selector  Where to insert the button.
   * @param {string} [variant] Extra class for styling.
   */
  function mount(selector, variant) {
    var host = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!host) return null;
    if (host.querySelector('[data-theme-toggle]')) return host.querySelector('[data-theme-toggle]');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-theme-toggle', '');
    btn.className = 'theme-toggle' + (variant ? ' ' + variant : '');
    btn.textContent = current() === DARK ? '☀' : '☾';
    btn.setAttribute('aria-label', current() === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', current() === DARK ? 'Switch to light mode' : 'Switch to dark mode');
    btn.addEventListener('click', toggle);
    host.appendChild(btn);
    return btn;
  }

  /* ---------- SYNC ACROSS TABS ---------- */
  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY && (e.newValue === LIGHT || e.newValue === DARK)) {
      document.documentElement.setAttribute('data-theme', e.newValue);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', e.newValue === DARK ? '#131312' : '#F7F5F2');
      var btns = document.querySelectorAll('[data-theme-toggle]');
      for (var i = 0; i < btns.length; i++) {
        btns[i].textContent = e.newValue === DARK ? '☀' : '☾';
        btns[i].setAttribute('aria-label', e.newValue === DARK ? 'Switch to light mode' : 'Switch to dark mode');
        btns[i].setAttribute('title', e.newValue === DARK ? 'Switch to light mode' : 'Switch to dark mode');
      }
    }
  });

  window.PHGTheme = {
    apply: apply,
    toggle: toggle,
    mount: mount,
    current: current,
    preferred: preferred,
    THEME_KEY: THEME_KEY,
  };

  /* ---------- BOOTSTRAP ---------- */
  // Apply the stored/preferred theme now. The pages that include this
  // script in <head> get the benefit before paint; pages that include it
  // at the end of <body> get it a moment later, which is still fine
  // because the inline head bootstrap already handled the flash.
  apply(preferred());
})();
