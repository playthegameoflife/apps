/* ============================================================
   post-theme.js — theme toggle for standalone blog posts
   ------------------------------------------------------------
   The standalone posts (blog-*.html) each carry their own inline
   <style> block and load no shared JS, so there was no way to
   switch them into dark mode. This adds a small fixed toggle in
   the top-right corner and restores the theme the user picked
   anywhere else on the site.

   Uses the same localStorage key as the app shell (phg_theme) so
   the theme is consistent across the site.
   ============================================================ */

(function () {
  'use strict';

  var THEME_KEY = 'phg_theme';

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#131312' : '#ffffff');
    var btn = document.getElementById('post-theme-toggle');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Apply before paint so the page never flashes white in dark mode.
  (function applyStoredTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && currentTheme() === 'dark') meta.setAttribute('content', '#131312');
  })();

  function buildToggle() {
    if (document.getElementById('post-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'post-theme-toggle';
    btn.className = 'post-theme-toggle';
    btn.type = 'button';
    btn.textContent = currentTheme() === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    document.body.appendChild(btn);
  }

  function boot() {
    buildToggle();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
