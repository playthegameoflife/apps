/* ============================================================
   blog.js — theme toggle + search for blog.html
   ------------------------------------------------------------
   WHY THIS FILE EXISTS
   --------------------
   Three defects this fixes:

   1. The blog index had NO search. The app-shell global search
      (shell.js:70) falls back to `blog.html?q=<query>` when the
      query doesn't match a library card or a history item. But
      blog.html had no <script> and never read the `q` parameter,
      so the fallback navigated to a page showing all 207 posts
      with no filtering. Search looked like it worked (it changed
      the URL) but did nothing.

   2. The blog index had no theme toggle. blog.html loads
      style.css only — no shell.js — so there was no way to reach
      dark mode from the blog at all.

   3. The index mixed in 27 MyCombat / martial-arts posts from a
      sibling app that lives in this same repository. They're
      reachable from apps.html and mycombat/, but they don't belong
      in a prompt-engineering blog index — a visitor landing here
      from a "prompt generator" query should not be shown
      "Best HIIT Timer for Martial Arts Training Sessions".
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
    if (meta) meta.setAttribute('content', t === 'dark' ? '#131312' : '#ffffff');
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
    if (t === 'dark' || t === 'light') {
      document.documentElement.setAttribute('data-theme', t);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && currentTheme() === 'dark') meta.setAttribute('content', '#131312');
  })();

  function buildThemeToggle() {
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
    var host = document.querySelector('.blog-header');
    if (host) host.appendChild(btn);
  }

  /* ---------- REMOVE OFF-TOPIC POSTS ---------- */
  var OFF_TOPIC = /mycombat|boxing|martial|judo|shadow-boxing|shadow-boxing|kickboxing|muay-thai|mma|hiit|combat|fighter|karate|taekwondo|workout-partner/i;

  function removeOffTopicPosts() {
    var removed = 0;

    // 1. Drop the whole "Martial Arts & Boxing" category.
    Array.prototype.slice.call(document.querySelectorAll('.blog-category')).forEach(function (cat) {
      var h = cat.querySelector('h2');
      if (h && OFF_TOPIC.test(h.textContent || '')) {
        removed += cat.querySelectorAll('.post-card').length;
        cat.remove();
      }
    });

    // 2. Drop individual off-topic posts that were filed under a
    //    prompt category (e.g. "Voice Guided Combat Training" was
    //    sitting inside "AI & Prompts").
    Array.prototype.slice.call(document.querySelectorAll('.post-card')).forEach(function (card) {
      var href = card.getAttribute('href') || '';
      var title = card.querySelector('.post-title');
      var titleText = title ? title.textContent : '';
      if (OFF_TOPIC.test(href) || OFF_TOPIC.test(titleText)) {
        card.remove();
        removed++;
      }
    });

    // 3. Recount each category heading so "(143 articles)" matches
    //    what's actually rendered.
    Array.prototype.slice.call(document.querySelectorAll('.blog-category')).forEach(function (cat) {
      var h = cat.querySelector('h2');
      var countEl = cat.querySelector('.count');
      if (!h || !countEl) return;
      var n = cat.querySelectorAll('.post-card').length;
      countEl.textContent = '(' + n + ' article' + (n === 1 ? '' : 's') + ')';
    });

    // 4. Drop a category that ended up empty.
    Array.prototype.slice.call(document.querySelectorAll('.blog-category')).forEach(function (cat) {
      if (!cat.querySelector('.post-card')) cat.remove();
    });

    return removed;
  }

  function updateCounts() {
    var total = document.querySelectorAll('.post-card').length;
    var label = document.getElementById('blog-count');
    if (label) label.textContent = String(total);
    var cats = document.querySelectorAll('.blog-category').length;
    var catEl = document.getElementById('blog-cat-count');
    if (catEl) catEl.textContent = String(cats);
    return total;
  }

  /* ---------- SEARCH ---------- */
  // Filters the rendered post cards client-side. There is no
  // search index on the server, so this works over the DOM
  // already present on the page — which is every post in the
  // index, not just the first screenful.
  function buildSearch() {
    var host = document.querySelector('.blog-header');
    if (!host || document.getElementById('blog-search')) return;

    var wrap = document.createElement('div');
    wrap.className = 'blog-search-wrap';

    var input = document.createElement('input');
    input.type = 'search';
    input.id = 'blog-search';
    input.className = 'blog-search';
    input.placeholder = 'Search ' + document.querySelectorAll('.post-card').length + ' guides…';
    input.setAttribute('aria-label', 'Search blog guides');
    input.autocomplete = 'off';

    var status = document.createElement('p');
    status.id = 'blog-search-status';
    status.className = 'blog-search-status';
    status.setAttribute('aria-live', 'polite');

    wrap.appendChild(input);
    wrap.appendChild(status);
    host.appendChild(wrap);

    var cards = Array.prototype.slice.call(document.querySelectorAll('.post-card'));
    var cats = Array.prototype.slice.call(document.querySelectorAll('.blog-category'));
    var empty = document.createElement('p');
    empty.className = 'blog-no-results';
    empty.hidden = true;
    empty.textContent = 'No guides match that search.';
    var container = document.querySelector('.blog-container');
    if (container) container.appendChild(empty);

    function apply() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;

      cards.forEach(function (card) {
        var hay = (card.textContent || '').toLowerCase();
        var hit = !q || hay.indexOf(q) !== -1;
        card.hidden = !hit;
        if (hit) shown++;
      });

      // Hide a whole category heading when none of its posts match.
      cats.forEach(function (cat) {
        var any = Array.prototype.some.call(cat.querySelectorAll('.post-card'), function (c) {
          return !c.hidden;
        });
        cat.hidden = !any;
      });

      empty.hidden = !(q && shown === 0);
      status.textContent = q
        ? shown + ' of ' + cards.length + ' guides match'
        : cards.length + ' guides';
    }

    input.addEventListener('input', apply);
    apply();

    // Support the app shell's fallback: /blog.html?q=<query>
    var initial = new URLSearchParams(window.location.search).get('q');
    if (initial) {
      input.value = initial;
      apply();
    }
  }

  function boot() {
    buildThemeToggle();
    removeOffTopicPosts();
    updateCounts();
    buildSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
