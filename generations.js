/* generations.js — "My Generations" page
 *
 * Reads the same browser-local history the generator writes (phg_history),
 * groups it by day, filters by mode, and renders a searchable archive.
 *
 * The tier limits mirror generate.js: Pro sees all 100, signed-in Free sees
 * 10, guests see 1. Locked items are counted and surfaced honestly rather
 * than silently truncated.
 */
(function () {
  'use strict';

  var HISTORY_KEY = 'phg_history';
  var TIERS = {
    guest: { limit: 1 },
    free:  { limit: 10 },
    pro:   { limit: 100, fullHistory: true }
  };

  var state = {
    history: [],
    q: '',
    mode: 'all',
    user: null,
    isPro: false,
    tier: 'guest'
  };

  function $(id) { return document.getElementById(id); }
  function lsGet(k, d) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function show(el) { if (el) el.classList.remove('hidden'); }
  function hide(el) { if (el) el.classList.add('hidden'); }

  // ---------- tier ----------
  function currentTier() {
    if (state.isPro) return 'pro';
    return state.user ? 'free' : 'guest';
  }
  function tierLimit() {
    return TIERS[currentTier()].limit;
  }

  // ---------- grouping ----------
  // The generator writes Date.now() (milliseconds). Some older or imported
  // records may be second-precision, which would render as 1970. Anything
  // below ~1e11 is seconds, so scale it up.
  function normTs(ts) {
    var n = Number(ts) || 0;
    if (n > 0 && n < 100000000000) return n * 1000;
    return n;
  }

  function startOfDay(ts) {
    var d = new Date(normTs(ts));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function dayLabel(ts) {
    var d = new Date(normTs(ts));
    var today = startOfDay(Date.now());
    var day = startOfDay(ts);
    var diffDays = Math.round((today - day) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) {
      return d.toLocaleDateString(undefined, { weekday: 'long' });
    }
    return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  function dayKey(ts) {
    var d = new Date(normTs(ts));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function timeLabel(ts) {
    return new Date(normTs(ts)).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function modeLabel(mode) {
    return String(mode || 'TEXT').replace('_ENHANCEMENT', '');
  }

  // ---------- filtering ----------
  function matchesQuery(h, q) {
    if (!q) return true;
    var hay = (h.prompt + ' ' + h.result + ' ' + (h.style || '') + ' ' +
               (h.target || '') + ' ' + (h.mode || '')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }
  function visibleItems() {
    var q = state.q.trim().toLowerCase();
    return state.history.filter(function (h) {
      if (state.mode !== 'all' && h.mode !== state.mode) return false;
      return matchesQuery(h, q);
    });
  }

  // ---------- rendering ----------
  function renderStats(total, shown) {
    var el = $('gen-stats');
    if (!el) return;
    var days = {};
    state.history.forEach(function (h) { days[dayKey(h.timestamp)] = 1; });
    var dayCount = Object.keys(days).length;
    el.innerHTML =
      '<div class="gen-stat"><span class="gen-stat-num">' + total + '</span>' +
      '<span class="gen-stat-label">Total</span></div>' +
      '<div class="gen-stat"><span class="gen-stat-num">' + shown + '</span>' +
      '<span class="gen-stat-label">Showing</span></div>' +
      '<div class="gen-stat"><span class="gen-stat-num">' + dayCount + '</span>' +
      '<span class="gen-stat-label">Days</span></div>';
  }

  function renderFilters() {
    var wrap = $('gen-filters');
    if (!wrap) return;
    var counts = {};
    state.history.forEach(function (h) { counts[h.mode] = (counts[h.mode] || 0) + 1; });
    var modes = Object.keys(counts).sort();
    var html = '<button class="gen-filter' + (state.mode === 'all' ? ' active' : '') +
               '" data-mode="all">All <span class="gen-filter-n">' + state.history.length + '</span></button>';
    modes.forEach(function (m) {
      html += '<button class="gen-filter' + (state.mode === m ? ' active' : '') +
              '" data-mode="' + escapeHtml(m) + '">' + escapeHtml(modeLabel(m)) +
              ' <span class="gen-filter-n">' + counts[m] + '</span></button>';
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.gen-filter').forEach(function (b) {
      b.addEventListener('click', function () {
        state.mode = b.dataset.mode;
        renderFilters();
        render();
      });
    });
  }

  function render() {
    var results = $('gen-results');
    var empty = $('gen-empty');
    if (!results) return;

    var matched = visibleItems();
    var limit = tierLimit();
    var total = state.history.length;

    // The newest items are first in the array (we unshift), so the tier limit
    // keeps the most recent N.
    var locked = matched.length > limit && !TIERS[currentTier()].fullHistory;
    var shown = matched.slice(0, limit);

    renderStats(total, shown.length);

    if (!shown.length) {
      results.innerHTML = '';
      if (empty) {
        show(empty);
        var t = $('gen-empty-title'), b = $('gen-empty-body');
        if (!total) {
          t.textContent = 'No generations yet';
          b.textContent = 'Prompts you create in the generator show up here, grouped by day.';
        } else if (state.q || state.mode !== 'all') {
          t.textContent = 'Nothing matches';
          b.textContent = 'Try a different search term or clear the filter.';
        } else {
          t.textContent = 'Nothing to show';
          b.textContent = 'Your generations are locked behind a lower plan.';
        }
      }
      return;
    }
    if (empty) hide(empty);

    // Map each shown item back to its real index in state.history so
    // delete removes the right record even when filtered or tier-limited.
    var shownIndex = [];
    var _seen = 0;
    for (var _i = 0; _i < state.history.length; _i++) {
      var _h = state.history[_i];
      if (state.mode !== 'all' && _h.mode !== state.mode) continue;
      if (state.q && !matchesQuery(_h, state.q)) continue;
      shownIndex.push(_i);
    }
    shownIndex = shownIndex.slice(0, limit);

    // group by day, preserving newest-first order
    var groups = [];
    var index = {};
    shown.forEach(function (h) {
      var k = dayKey(h.timestamp);
      // NOTE: must use hasOwnProperty, not `!index[k]`. The first group's
      // index is 0, which is falsy, so `!index[k]` was true and every item
      // of the first day spawned its own duplicate group header.
      if (!Object.prototype.hasOwnProperty.call(index, k)) {
        index[k] = groups.length;
        groups.push({ key: k, label: dayLabel(h.timestamp), ts: h.timestamp, items: [] });
      }
      groups[index[k]].items.push(h);
    });

    results.innerHTML = groups.map(function (g) {
      return '<section class="gen-day">' +
        '<header class="gen-day-head">' +
          '<h2>' + escapeHtml(g.label) + '</h2>' +
          '<span class="gen-day-count">' + g.items.length +
            (g.items.length === 1 ? ' prompt' : ' prompts') + '</span>' +
        '</header>' +
        '<div class="gen-day-list">' + g.items.map(cardHtml).join('') + '</div>' +
      '</section>';
    }).join('');

    // wire the actions
    results.querySelectorAll('.gen-card').forEach(function (el) {
      // data-idx is the index into the filtered `shown` list, NOT into
      // state.history. Keep the real index so delete removes the right item.
      var idx = parseInt(el.dataset.idx, 10);
      var h = shown[idx];
      if (!h) return;
      var realIdx = shownIndex[idx];
      if (realIdx === undefined) realIdx = idx;

      var copyBtn = el.querySelector('[data-act="copy"]');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          var text = h.result || '';
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              copyBtn.textContent = 'Copied';
              setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1400);
            }).catch(function () { fallbackCopy(text, copyBtn); });
          } else {
            fallbackCopy(text, copyBtn);
          }
        });
      }

      var reuseBtn = el.querySelector('[data-act="reuse"]');
      if (reuseBtn) {
        reuseBtn.addEventListener('click', function () {
          // Carry the original prompt + mode/style/target back into the generator.
          var p = new URLSearchParams();
          if (h.mode) p.set('mode', h.mode.replace('_ENHANCEMENT', ''));
          if (h.style) p.set('style', h.style);
          if (h.target) p.set('target', h.target);
          p.set('prompt', h.prompt || '');
          location.href = '/?' + p.toString();
        });
      }

      var delBtn = el.querySelector('[data-act="delete"]');
      if (delBtn) {
        delBtn.addEventListener('click', function () {
          state.history.splice(realIdx, 1);
          try { localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 100))); }
          catch (e) { /* quota or private mode — the in-memory list still updates */ }
          renderFilters();
          render();
        });
      }
    });

    if (locked) renderLockedNote(shown.length, matched.length);
    else {
      var note = $('gen-lock-note');
      if (note) hide(note);
    }
  }

  function fallbackCopy(text, btn) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); btn.textContent = 'Copied'; }
    catch (e) { btn.textContent = 'Failed'; }
    document.body.removeChild(ta);
    setTimeout(function () { btn.textContent = 'Copy'; }, 1400);
  }

  function renderLockedNote(shownCount, matchedCount) {
    var note = $('gen-lock-note');
    if (!note) return;
    var tier = currentTier();
    var txt, cta;
    if (tier === 'pro') { hide(note); return; }
    if (tier === 'free') {
      txt = "You're seeing " + shownCount + " of " + matchedCount +
            " matching generations. Pro unlocks your full history.";
      cta = 'See Pro';
    } else {
      txt = "You're seeing " + shownCount + " of " + matchedCount +
            " matching generations. Sign in free to keep 10, or go Pro for all 100.";
      cta = 'Sign in for free';
    }
    show(note);
    var t = $('gen-lock-text');
    if (t) t.textContent = txt;
    var c = $('gen-lock-cta');
    if (c) {
      c.textContent = cta;
      c.onclick = function () {
        if (tier === 'free') location.href = '/pricing.html';
        else if (window.PHGAuth) window.PHGAuth.signIn();
      };
    }
  }

  function cardHtml(h, i) {
    var badges = '<span class="gen-badge gen-badge-mode">' + escapeHtml(modeLabel(h.mode)) + '</span>';
    if (h.style) badges += '<span class="gen-badge">' + escapeHtml(h.style) + '</span>';
    if (h.target) badges += '<span class="gen-badge gen-badge-target">' + escapeHtml(h.target) + '</span>';
    var when = h.timestamp ? timeLabel(h.timestamp) : '';
    var preview = h.result || h.prompt || '';
    var full = h.prompt && h.prompt !== h.result ? h.prompt : '';
    return '<article class="gen-card" data-idx="' + i + '">' +
      '<div class="gen-card-top">' +
        '<div class="gen-badges">' + badges + '</div>' +
        '<time class="gen-time">' + escapeHtml(when) + '</time>' +
      '</div>' +
      '<div class="gen-card-body">' + escapeHtml(preview) + '</div>' +
      (full ? '<details class="gen-card-more"><summary>Original input</summary>' +
              '<pre class="gen-card-orig">' + escapeHtml(full) + '</pre></details>' : '') +
      '<div class="gen-card-actions">' +
        '<button class="btn btn-sm" data-act="copy">Copy</button>' +
        '<button class="btn btn-sm" data-act="reuse">Reuse</button>' +
        '<button class="btn btn-sm btn-ghost-danger" data-act="delete">Delete</button>' +
      '</div>' +
    '</article>';
  }

  // ---------- init ----------
  function load() {
    var raw = lsGet(HISTORY_KEY, []);
    state.history = Array.isArray(raw) ? raw : [];
    state.user = lsGet('phg_user', null);
    state.isPro = !!(state.user && state.user.pro);
    state.tier = currentTier();
  }

  function init() {
    load();

    // Allow ?q= from the global search box in the topbar.
    try {
      var params = new URLSearchParams(location.search);
      var q = params.get('q');
      if (q) state.q = q;
      var m = params.get('mode');
      if (m) state.mode = m;
    } catch (e) { /* older browser — ignore */ }

    renderFilters();
    render();

    var search = $('gen-search');
    var clear = $('gen-search-clear');
    if (search && state.q) {
      search.value = state.q;
      if (clear) show(clear);
    }
    if (search) {
      search.addEventListener('input', function () {
        state.q = search.value || '';
        if (clear) { state.q ? show(clear) : hide(clear); }
        render();
      });
    }
    if (clear) {
      clear.addEventListener('click', function () {
        state.q = '';
        if (search) { search.value = ''; search.focus(); }
        hide(clear);
        render();
      });
    }

    // Reflect a sign-in that happened in another tab.
    window.addEventListener('storage', function (e) {
      if (e.key === HISTORY_KEY || e.key === 'phg_user') {
        load();
        renderFilters();
        render();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PHGGenerations = {
    reload: function () { load(); renderFilters(); render(); }
  };
})();
