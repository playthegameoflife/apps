/* Top-bar search dropdown. Results come from /search-index.json (built by
   tools/build_search_index.py): sample prompts, tools and guides, plus library
   prompt names fetched from the backend for the visitor's plan. */
(function () {
  'use strict';
  var input = document.getElementById('tb-search-input');
  if (!input) return;
  var wrap = input.closest('.tb-search');
  var BACKEND = 'https://api-clyep56cdq-uc.a.run.app';
  var index = null, loading = null, active = -1, rows = [];
  function headers() {
    var h = {};
    try {
      var t = window.PHGAuth && window.PHGAuth.getAccessToken ? window.PHGAuth.getAccessToken() : null;
      if (t) h['x-phg-access-token'] = t;
      var a = localStorage.getItem('phg_anon_id'); if (a) h['x-phg-anon-id'] = a;
    } catch (e) {}
    return h;
  }
  var box = document.createElement('div');
  box.className = 'tb-results'; box.id = 'tb-results'; box.setAttribute('role', 'listbox'); box.hidden = true;
  wrap.appendChild(box);
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', 'tb-results'); input.setAttribute('autocomplete', 'off');
  input.placeholder = 'Search prompts, tools, guides…';

  function load() {
    if (index || loading) return loading;
    var base = fetch('/search-index.json').then(function (r) { return r.json(); }).catch(function () { return []; });
    // The library catalog is served per plan by the backend. Names only; if the
    // request fails the dropdown simply works without library prompts.
    var lib = fetch(BACKEND + '/library', { headers: headers() })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.items) return [];
        var cats = {}; (d.cats || []).forEach(function (c) { cats[c.id] = c.name; });
        return d.items.map(function (it) { return { k: 'lib', t: it.n, u: '/library.html?q=' + encodeURIComponent(it.n), d: cats[it.c] || '' }; });
      }).catch(function () { return []; });
    loading = Promise.all([base, lib]).then(function (r) { index = r[0].concat(r[1]); });
    return loading;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mark(text, words) {
    var out = esc(text);
    words.forEach(function (w) { if (w.length > 1) out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<b>$1</b>'); });
    return out;
  }
  function search(q) {
    var words = q.toLowerCase().split(/\s+/).filter(Boolean);
    var scored = [];
    index.forEach(function (it) {
      var t = it.t.toLowerCase(), d = (it.d || '').toLowerCase(), s = 0, ok = true;
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (t.indexOf(w) === 0) s += 6; else if (t.indexOf(' ' + w) !== -1) s += 4; else if (t.indexOf(w) !== -1) s += 3;
        else if (d.indexOf(w) !== -1) s += 1; else { ok = false; break; }
      }
      if (ok) scored.push({ it: it, s: s });
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    var groups = { tool: [], lib: [], prompt: [], guide: [] }, caps = { tool: 3, lib: 5, prompt: 3, guide: 4 };
    scored.forEach(function (x) { var g = groups[x.it.k]; if (g.length < caps[x.it.k]) g.push(x.it); });
    return { words: words, groups: groups };
  }
  var LABEL = { tool: 'Tools', lib: 'Library prompts', prompt: 'Examples', guide: 'Guides' };
  function render() {
    var q = input.value.trim();
    rows = []; active = -1;
    if (!q) { close(); return; }
    var res = search(q), html = '';
    ['tool', 'lib', 'prompt', 'guide'].forEach(function (k) {
      var g = res.groups[k]; if (!g.length) return;
      html += '<div class="tb-res-head">' + LABEL[k] + '</div>';
      g.forEach(function (it) {
        rows.push(it.u);
        html += '<a class="tb-res" role="option" id="tb-res-' + (rows.length - 1) + '" href="' + esc(it.u) + '"><span class="tb-res-t">' + mark(it.t, res.words) + '</span>' + (it.d && k !== 'guide' && k !== 'lib' ? '<span class="tb-res-d">' + esc(it.d) + '</span>' : '') + '</a>';
      });
    });
    var enc = encodeURIComponent(q);
    html += '<div class="tb-res-head">Search everywhere</div>' +
      '<a class="tb-res" role="option" id="tb-res-' + rows.length + '" href="/library.html?q=' + enc + '"><span class="tb-res-t">Search the prompt library for “' + esc(q) + '”</span></a>';
    rows.push('/library.html?q=' + enc);
    html += '<a class="tb-res" role="option" id="tb-res-' + rows.length + '" href="/blog.html?q=' + enc + '"><span class="tb-res-t">Search all guides for “' + esc(q) + '”</span></a>';
    rows.push('/blog.html?q=' + enc);
    box.innerHTML = html; box.hidden = false; input.setAttribute('aria-expanded', 'true');
  }
  function close() { box.hidden = true; input.setAttribute('aria-expanded', 'false'); active = -1; }
  function setActive(i) {
    var els = box.querySelectorAll('.tb-res');
    els.forEach(function (e) { e.classList.remove('on'); e.removeAttribute('aria-selected'); });
    active = i;
    if (i >= 0 && els[i]) { els[i].classList.add('on'); els[i].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', els[i].id); els[i].scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }

  input.addEventListener('focus', load);
  input.addEventListener('input', function () { (load() || Promise.resolve()).then(render); });
  // capture: runs before shell.js's Enter handler; only takes over when a result is highlighted
  input.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    var n = rows.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % n); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active <= 0 ? n - 1 : active - 1); }
    else if (e.key === 'Escape') { close(); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); e.stopImmediatePropagation(); location.href = rows[active]; }
  }, true);
  document.addEventListener('click', function (e) { if (!wrap.contains(e.target)) close(); });
  input.addEventListener('focus', function () { if (input.value.trim() && index) render(); });
})();
