/* ============================================================
   PROMPT LIBRARY — behaviour
   Category rail, search, incremental grid, prompt drawer.
   Data: LIB_CATS / LIB_ITEMS from library-data.js
   Bodies: lazy-loaded per category from /lib-texts/<cat>.json
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const PAGE = 120;

  const state = {
    cat: 'all',
    q: '',
    shown: PAGE,
    texts: {},        // cat -> array of prompt bodies
    loading: {},      // cat -> promise
    current: null,   // currently open item
  };

  /* ---------- INDEX BUILD ---------- */
  // LIB_ITEMS is contiguous per category, so each category owns a slice.
  const byCat = {};
  const localIdx = {};   // flat index -> index within its category file
  LIB_ITEMS.forEach((it, i) => {
    (byCat[it.c] = byCat[it.c] || []).push(i);
    localIdx[i] = byCat[it.c].length - 1;
  });

  const MODE_LABEL = {
    TEXT_ENHANCEMENT: 'Text',
    CODE_ENHANCEMENT: 'Code',
    IMAGE_ENHANCEMENT: 'Image',
    VIDEO_ENHANCEMENT: 'Video',
  };
  const STYLE_FOR_MODE = {
    TEXT_ENHANCEMENT: 'detailed',
    CODE_ENHANCEMENT: 'comprehensive',
    IMAGE_ENHANCEMENT: 'cinematic',
    VIDEO_ENHANCEMENT: 'cinematic',
  };

  const catMeta = {};
  LIB_CATS.forEach(c => { catMeta[c.id] = c; });

  /* ---------- CATEGORY RAIL ---------- */
  const railList = $('lib-rail-list');
  function buildRail() {
    if (!railList) return;
    const frag = document.createDocumentFragment();
    const all = document.createElement('button');
    all.className = 'lib-rail-item active';
    all.dataset.cat = 'all';
    all.innerHTML = '<span class="lib-rail-icon">✦</span>' +
      '<span class="lib-rail-label">All prompts</span>' +
      '<span class="lib-rail-count">' + LIB_ITEMS.length + '</span>';
    frag.appendChild(all);
    LIB_CATS.forEach(c => {
      const b = document.createElement('button');
      b.className = 'lib-rail-item';
      b.dataset.cat = c.id;
      b.innerHTML = '<span class="lib-rail-icon">' + c.icon + '</span>' +
        '<span class="lib-rail-label">' + c.name + '</span>' +
        '<span class="lib-rail-count">' + c.count + '</span>';
      frag.appendChild(b);
    });
    railList.appendChild(frag);
    railList.addEventListener('click', (e) => {
      const btn = e.target.closest('.lib-rail-item');
      if (!btn) return;
      state.cat = btn.dataset.cat;
      state.shown = PAGE;
      railList.querySelectorAll('.lib-rail-item').forEach(b =>
        b.classList.toggle('active', b === btn));
      render();
    });
  }

  /* ---------- TEXT LOADING ---------- */
  function loadTexts(cat) {
    if (state.texts[cat]) return Promise.resolve(state.texts[cat]);
    if (state.loading[cat]) return state.loading[cat];
    state.loading[cat] = fetch('/lib-texts/' + cat + '.json')
      .then(r => r.ok ? r.json() : [])
      .then(arr => {
        state.texts[cat] = arr;
        delete state.loading[cat];
        return arr;
      })
      .catch(() => {
        state.texts[cat] = [];
        delete state.loading[cat];
        return [];
      });
    return state.loading[cat];
  }

  // Warm the corpus in the background so full-text search works without
  // blocking first paint. Category files are cached independently.
  let warmed = false;
  function warmAll() {
    if (warmed) return;
    warmed = true;
    const cats = LIB_CATS.map(c => c.id);
    (function next(i) {
      if (i >= cats.length) return;
      loadTexts(cats[i]).then(() => setTimeout(() => next(i + 1), 40));
    })(0);
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warmAll, { timeout: 2500 });
  else setTimeout(warmAll, 1500);

  /* ---------- FILTERING ---------- */
  function filtered() {
    const q = state.q;
    const out = [];
    for (let i = 0; i < LIB_ITEMS.length; i++) {
      const it = LIB_ITEMS[i];
      if (state.cat !== 'all' && it.c !== state.cat) continue;
      if (!q) { out.push(i); continue; }
      if (it.n.toLowerCase().indexOf(q) !== -1) { out.push(i); continue; }
      const bodies = state.texts[it.c];
      if (!bodies) continue;             // text not loaded yet — name-only match
      const b = bodies[localIdx[i]];
      if (b && b.toLowerCase().indexOf(q) !== -1) out.push(i);
    }
    return out;
  }

  /* ---------- RENDER ---------- */
  const cards = $('lib-cards');
  const countEl = $('lib-count');
  const clearBtn = $('lib-clear');

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render() {
    if (!cards) return;
    const list = filtered();
    const total = list.length;
    const slice = list.slice(0, state.shown);

    if (countEl) {
      countEl.textContent = total === 0
        ? 'No prompts found'
        : (total < LIB_ITEMS.length
          ? total.toLocaleString() + ' of ' + LIB_ITEMS.length.toLocaleString() + ' prompts'
          : LIB_ITEMS.length.toLocaleString() + ' prompts');
    }
    if (clearBtn) clearBtn.classList.toggle('on', !!state.q);

    if (!total) {
      cards.innerHTML =
        '<div class="lib-empty">' +
          '<h3>No prompts match “' + esc(state.q) + '”</h3>' +
          '<p>Try a different keyword, or browse a category from the left.</p>' +
        '</div>';
      return;
    }

    const frag = document.createDocumentFragment();
    slice.forEach(i => {
      const it = LIB_ITEMS[i];
      const meta = catMeta[it.c] || { name: it.c, icon: '✦' };
      const b = document.createElement('button');
      b.className = 'lib-pcard';
      b.type = 'button';
      b.dataset.idx = String(i);
      b.innerHTML =
        '<div class="lib-pcard-top">' +
          '<span class="lib-pcard-cat">' + esc(meta.icon + ' ' + meta.name) + '</span>' +
          '<span class="lib-pcard-mode">' + esc(MODE_LABEL[it.m] || 'Text') + '</span>' +
        '</div>' +
        '<div class="lib-pcard-name">' + esc(it.n) + '</div>' +
        '<div class="lib-pcard-foot">' +
          '<span>View prompt</span>' +
          '<span class="lib-pcard-use">Use →</span>' +
        '</div>';
      frag.appendChild(b);
    });

    if (total > slice.length) {
      const more = document.createElement('button');
      more.className = 'lib-pcard';
      more.type = 'button';
      more.style.gridColumn = '1 / -1';
      more.style.display = 'flex';
      more.style.alignItems = 'center';
      more.style.justifyContent = 'center';
      more.style.borderStyle = 'dashed';
      more.textContent = 'Load ' + Math.min(PAGE, total - slice.length).toLocaleString() +
        ' more (' + (total - slice.length).toLocaleString() + ' remaining)';
      more.addEventListener('click', () => {
        state.shown += PAGE;
        render();
      });
      frag.appendChild(more);
    }

    cards.innerHTML = '';
    cards.appendChild(frag);
  }

  /* ---------- DRAWER ---------- */
  const drawer = $('lib-drawer');
  const scrim = $('lib-scrim');
  const dTitle = $('lib-drawer-title');
  const dMeta = $('lib-drawer-meta');
  const dText = $('lib-drawer-text');
  const dMsg = $('lib-drawer-msg');

  function bodyFor(idx) {
    const it = LIB_ITEMS[idx];
    const bodies = state.texts[it.c];
    if (!bodies) return null;
    return bodies[localIdx[idx]];
  }

  function openDrawer(idx) {
    const it = LIB_ITEMS[idx];
    state.current = idx;
    const meta = catMeta[it.c] || { name: it.c, icon: '✦' };
    if (dTitle) dTitle.textContent = it.n;
    if (dMeta) dMeta.textContent = meta.icon + ' ' + meta.name + ' · ' + (MODE_LABEL[it.m] || 'Text');
    if (dMsg) dMsg.textContent = '';
    if (dText) dText.textContent = 'Loading…';

    if (drawer) { drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add('open')); }
    if (scrim) scrim.classList.add('open');
    document.body.style.overflow = 'hidden';

    const known = bodyFor(idx);
    if (known !== null) {
      if (dText) dText.textContent = known;
      return;
    }
    loadTexts(it.c).then(() => {
      if (state.current !== idx) return;
      const b = bodyFor(idx);
      if (dText) dText.textContent = b || '(Prompt body unavailable)';
    });
  }

  function closeDrawer() {
    state.current = null;
    if (drawer) drawer.classList.remove('open');
    if (scrim) scrim.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (drawer && !drawer.classList.contains('open')) drawer.hidden = true; }, 240);
  }

  if (cards) {
    cards.addEventListener('click', (e) => {
      const c = e.target.closest('.lib-pcard');
      if (!c || !c.dataset.idx) return;
      openDrawer(parseInt(c.dataset.idx, 10));
    });
  }
  const dClose = $('lib-drawer-close');
  if (dClose) dClose.addEventListener('click', closeDrawer);
  if (scrim) scrim.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) closeDrawer();
  });

  const dCopy = $('lib-drawer-copy');
  if (dCopy) dCopy.addEventListener('click', () => {
    if (state.current === null) return;
    const b = bodyFor(state.current);
    if (!b) return;
    navigator.clipboard.writeText(b).then(() => {
      dCopy.textContent = 'Copied!';
      if (dMsg) dMsg.textContent = 'Prompt copied to clipboard';
      setTimeout(() => { dCopy.textContent = 'Copy prompt'; }, 1800);
    }).catch(() => { if (dMsg) dMsg.textContent = 'Copy failed — select the text manually'; });
  });

  const dUse = $('lib-drawer-use');
  if (dUse) dUse.addEventListener('click', () => {
    if (state.current === null) return;
    const it = LIB_ITEMS[state.current];
    const b = bodyFor(state.current) || it.n;
    // Prompt bodies run to thousands of characters, which blows past URL
    // length limits. Hand off through localStorage and pass only a key.
    const key = 'lib_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
    try {
      localStorage.setItem('phg_lib_' + key, JSON.stringify({
        p: b,
        m: it.m,
        s: STYLE_FOR_MODE[it.m] || 'default',
      }));
    } catch (e) {
      // localStorage full or blocked — fall back to the query string
      window.location.href = '/?p=' + encodeURIComponent(b);
      return;
    }
    window.location.href = '/?lib=' + encodeURIComponent(key);
  });

  /* ---------- SEARCH ---------- */
  const search = $('lib-search');
  let searchTimer = null;
  if (search) {
    search.addEventListener('input', () => {
      state.q = search.value.trim().toLowerCase();
      state.shown = PAGE;
      clearTimeout(searchTimer);
      // if the query needs body text, make sure it's loaded
      if (state.q) warmAll();
      searchTimer = setTimeout(render, 120);
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      state.q = '';
      state.shown = PAGE;
      if (search) { search.value = ''; search.focus(); }
      render();
    });
  }

  /* ---------- DEEP LINK: ?cat=writing ---------- */
  const params = new URLSearchParams(location.search);
  const catParam = params.get('cat');
  if (catParam && catMeta[catParam]) {
    state.cat = catParam;
    const btn = railList && railList.querySelector('.lib-rail-item[data-cat="' + catParam + '"]');
    if (btn) {
      railList.querySelectorAll('.lib-rail-item').forEach(b => b.classList.toggle('active', b === btn));
    }
  }

  /* ---------- TOPBAR SEARCH BRIDGE ---------- */
  // shell.js handles the global search; make Enter land here.
  const tbSearch = $('tb-search-input');
  if (tbSearch) {
    tbSearch.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = tbSearch.value.trim();
      if (!q) return;
      const inLib = LIB_ITEMS.some(it => it.n.toLowerCase().indexOf(q.toLowerCase()) !== -1);
      if (inLib) {
        state.q = q.toLowerCase();
        state.shown = PAGE;
        if (search) search.value = q;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  buildRail();
  render();
})();
