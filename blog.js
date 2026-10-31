/* ============================================================
   blog.js — blog index page
   ------------------------------------------------------------
   Scope: this file drives the BLOG INDEX ONLY. Individual post
   pages are separate files and are not touched by this script.

   What it does:
     1. Theme toggle (light/dark) with no flash on load.
     2. Live search across every guide on the page.
     3. Category filters (All / AI & Prompts / Marketing & Tools).
     4. Keeps the header counts in sync with what is rendered.

   The old implementation also stripped off-topic MyCombat posts
   at runtime. Those posts are no longer present in the index at
   all — they are filtered out of the source HTML instead — so
   there is nothing to strip here anymore. See blog-index-build.
   ============================================================ */

(function () {
  'use strict';

  var THEME_KEY = 'phg_theme';

  /* ---------- THEME ---------- */
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#0E0E0D' : '#FAFAF8');
    var btn = document.getElementById('blog-theme-toggle');
    if (btn) {
      btn.textContent = t === 'dark' ? '☀' : '☾';
      btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  // Apply the stored theme before paint to avoid a white flash.
  (function applyStoredTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    // The site is light-only now: ignore any stored or system dark preference.
    document.documentElement.setAttribute('data-theme', 'light');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && currentTheme() === 'dark') meta.setAttribute('content', '#0E0E0D');
  })();

  function buildThemeToggle() {
    return; // light-only: no toggle
    if (document.getElementById('blog-theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'blog-theme-toggle';
    btn.className = 'blog-theme-toggle';
    btn.type = 'button';
    btn.textContent = currentTheme() === 'dark' ? '☀' : '☾';
    btn.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    btn.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    var host = document.querySelector('.blog-hero');
    if (host) host.appendChild(btn);
  }

  /* ---------- SEARCH + FILTERS ---------- */
  var grid = document.getElementById('blog-grid');
  var featured = document.getElementById('featured-section');
  var search = document.getElementById('blog-search');
  var status = document.getElementById('blog-search-status');
  var noResults = document.getElementById('blog-no-results');
  var filters = document.getElementById('blog-filters');

  // Only the cards in the "All guides" grid are filtered. The featured
  // strip is a curated "latest" highlight and hides itself entirely
  // when a search is active or a category is selected, so the page
  // never shows the same guide twice.
  var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll('.post-card')) : [];
  var featCards = featured ? Array.prototype.slice.call(featured.querySelectorAll('.feat-card')) : [];
  var activeCat = 'all';

  function matches(card, q) {
    if (activeCat !== 'all' && card.getAttribute('data-cat') !== activeCat) return false;
    if (!q) return true;
    var hay = (card.textContent || '').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function apply() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var shown = 0;

    cards.forEach(function (card) {
      var hit = matches(card, q);
      card.hidden = !hit;
      if (hit) shown++;
    });

    // Hide the featured strip whenever a filter or search is narrowing
    // things down — otherwise the same article can appear twice.
    var filtering = !!q || activeCat !== 'all';
    if (featured) featured.hidden = filtering;

    if (noResults) noResults.hidden = !(shown === 0);

    if (status) {
      if (q && activeCat !== 'all') {
        status.textContent = shown + ' of ' + cards.length + ' guides match “' + q + '” in ' + activeCat;
      } else if (q) {
        status.textContent = shown + ' of ' + cards.length + ' guides match';
      } else if (activeCat !== 'all') {
        status.textContent = shown + ' ' + activeCat + ' guides';
      } else {
        status.textContent = cards.length + ' guides';
      }
    }
  }

  function bindSearch() {
    if (!search) return;
    var timer = null;
    search.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(apply, 120);
    });
    // Support the app shell's fallback: /blog.html?q=<query>
    var initial = new URLSearchParams(window.location.search).get('q');
    if (initial) search.value = initial;
  }

  function bindFilters() {
    if (!filters) return;
    filters.addEventListener('click', function (e) {
      var btn = e.target.closest('.blog-filter');
      if (!btn) return;
      filters.querySelectorAll('.blog-filter').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      activeCat = btn.getAttribute('data-cat') || 'all';
      apply();
    });
  }

  function boot() {
    buildThemeToggle();
    bindSearch();
    bindFilters();
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
