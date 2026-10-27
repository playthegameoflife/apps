/* Top-bar search = prompt library search.
   Matches prompt names from the library catalog the backend serves for the
   visitor's plan (the same list the Library page uses), and sends Enter to
   the Library page, which also searches inside prompt text.
   On the Library page itself the top bar already drives the page's own search. */
(function () {
  'use strict';
  var input = document.getElementById('tb-search-input');
  if (!input) return;
  var onLibrary = /\/library(\.html)?$/.test(location.pathname);
  input.placeholder = 'Search the prompt library…';
  input.setAttribute('aria-label', 'Search the prompt library');
  if (onLibrary) {
    // The page already has its own library search: drive it from the top bar.
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var q = input.value.trim(), lib = document.getElementById('lib-search');
      if (!q || !lib) return;
      e.preventDefault(); e.stopImmediatePropagation();
      lib.value = q; lib.dispatchEvent(new Event('input', { bubbles: true }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, true);
    return;
  }

  var BACKEND = 'https://api-clyep56cdq-uc.a.run.app';
  var wrap = input.closest('.tb-search');
  var items = null, loading = null, active = -1, rows = [];
  var box = document.createElement('div');
  box.className = 'tb-results'; box.id = 'tb-results'; box.setAttribute('role', 'listbox'); box.hidden = true;
  wrap.appendChild(box);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'tb-results'); input.setAttribute('autocomplete', 'off');

  function headers() {
    var h = {};
    try {
      var t = window.PHGAuth && window.PHGAuth.getAccessToken ? window.PHGAuth.getAccessToken() : null;
      if (t) h['x-phg-access-token'] = t;
      var a = localStorage.getItem('phg_anon_id'); if (a) h['x-phg-anon-id'] = a;
    } catch (e) {}
    return h;
  }
  function load() {
    if (items || loading) return loading;
    loading = fetch(BACKEND + '/library', { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var cats = {}; ((d && d.cats) || []).forEach(function (c) { cats[c.id] = c.name; });
        items = ((d && d.items) || []).map(function (it) { return { t: it.n, c: cats[it.c] || '' }; });
      }).catch(function () { items = []; });
    return loading;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) { if (w.length > 1) out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<b>$1</b>'); });
    return out;
  }
  function libUrl(q) { return '/library.html?q=' + encodeURIComponent(q); }
  function render() {
    var q = input.value.trim();
    rows = []; active = -1;
    if (!q) { close(); return; }
    var words = q.toLowerCase().split(/\s+/).filter(Boolean), hits = [];
    (items || []).forEach(function (it) {
      var t = it.t.toLowerCase(), s = 0;
      for (var i = 0; i < words.length; i++) {
        var p = t.indexOf(words[i]);
        if (p === -1) return;
        s += p === 0 ? 3 : (t.charAt(p - 1) === ' ' ? 2 : 1);
      }
      hits.push({ it: it, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    var html = '';
    if (hits.length) html += '<div class="tb-res-head">Prompt library</div>';
    hits.slice(0, 7).forEach(function (h) {
      rows.push(libUrl(h.it.t));
      html += '<a class="tb-res" role="option" id="tb-res-' + (rows.length - 1) + '" href="' + esc(libUrl(h.it.t)) + '"><span class="tb-res-t">' + mark(h.it.t, words) + '</span>' + (h.it.c ? '<span class="tb-res-d">' + esc(h.it.c) + '</span>' : '') + '</a>';
    });
    rows.push(libUrl(q));
    html += '<a class="tb-res" role="option" id="tb-res-' + (rows.length - 1) + '" href="' + esc(libUrl(q)) + '"><span class="tb-res-t">' +
      (hits.length ? 'See all results for “' : 'Search the library for “') + esc(q) + '”</span><span class="tb-res-d">Also searches inside prompt text</span></a>';
    box.innerHTML = html; box.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; input.removeAttribute('aria-activedescendant'); }
  function setActive(i) {
    var els = box.querySelectorAll('.tb-res');
    els.forEach(function (e) { e.classList.remove('on'); e.removeAttribute('aria-selected'); });
    active = i;
    if (i >= 0 && els[i]) { els[i].classList.add('on'); els[i].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', els[i].id); els[i].scrollIntoView({ block: 'nearest' }); }
  }

  input.addEventListener('focus', function () { load(); if (input.value.trim() && items) render(); });
  input.addEventListener('input', function () { (load() || Promise.resolve()).then(render); });
  // Capture phase: runs before shell.js's own Enter handler, which we replace here.
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Enter') {
      var q = input.value.trim();
      if (!q) return;
      e.preventDefault(); e.stopImmediatePropagation();
      location.href = (active >= 0 && rows[active]) ? rows[active] : libUrl(q);
      return;
    }
    if (box.hidden) return;
    var n = rows.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? n - 1 : active - 1); }
  }, true);
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
})();
