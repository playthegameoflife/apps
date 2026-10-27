/* ============================================================
   PROMPT LIBRARY — behaviour
   Category rail, search, incremental grid, prompt drawer.

   TIERED ACCESS
   ------------
   The catalog is served by the backend, which decides the tier from a
   verified Google token (or falls back to a guest tier). The static
   site ships NO prompt catalog at all — the full 2,140 prompts live
   only in the Cloud Function.

     GET /library        -> catalog metadata + items for this tier
     GET /library/bodies -> per-category prompt bodies for this tier

   Free and Guest tiers receive a 300-prompt subset with a fair spread
   across every category. Pro receives all 2,140.

   The frontend renders whatever the backend returns. It never filters a
   full catalog down to a smaller one — there is nothing to filter,
   because the restricted prompts were never sent.
   ============================================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const PAGE = 120;
  const BACKEND_URL = 'https://api-clyep56cdq-uc.a.run.app';

  const state = {
    cat: 'all',
    q: '',
    shown: PAGE,
    texts: {},        // cat -> array of prompt bodies
    loading: {},      // cat -> promise
    current: null,   // currently open item
    items: [],       // items for this tier
    cats: [],        // categories for this tier
    tier: 'guest',
    restricted: true,
    fullTotal: 0,
    ready: false,
  };

  /* ---------- TIER / ITEMS ----------
     These replace the old build-time LIB_ITEMS / LIB_CATS globals.
     They are populated from the backend before the first render. */
  const byCat = {};
  const localIdx = {};   // flat index -> index within its category body array

  function indexItems(items) {
    Object.keys(byCat).forEach(k => delete byCat[k]);
    Object.keys(localIdx).forEach(k => delete localIdx[k]);
    items.forEach((it, i) => {
      (byCat[it.c] = byCat[it.c] || []).push(i);
      localIdx[i] = byCat[it.c].length - 1;
    });
  }

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
  function indexCats(cats) {
    Object.keys(catMeta).forEach(k => delete catMeta[k]);
    cats.forEach(c => { catMeta[c.id] = c; });
  }

  /* ---------- AUTH HEADERS ---------- */
  function getAnonId() {
    try {
      let id = localStorage.getItem('phg_anon_id');
      if (!id) {
        id = 'a_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
        localStorage.setItem('phg_anon_id', id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  function backendHeaders(extra) {
    const headers = Object.assign({}, extra || {});
    const token = window.PHGAuth && window.PHGAuth.getAccessToken
      ? window.PHGAuth.getAccessToken()
      : null;
    if (token) headers['x-phg-access-token'] = token;
    const anon = getAnonId();
    if (anon) headers['x-phg-anon-id'] = anon;
    return headers;
  }

  /* ---------- CATEGORY RAIL ---------- */
  const railList = $('lib-rail-list');
  function buildRail() {
    if (!railList) return;
    railList.innerHTML = '';
    const frag = document.createDocumentFragment();
    const all = document.createElement('button');
    all.className = 'lib-rail-item active';
    all.dataset.cat = 'all';
    all.innerHTML = '<span class="lib-rail-icon">✦</span>' +
      '<span class="lib-rail-label">All prompts</span>' +
      '<span class="lib-rail-count">' + state.items.length.toLocaleString() + '</span>';
    frag.appendChild(all);
    state.cats.forEach(c => {
      const b = document.createElement('button');
      b.className = 'lib-rail-item';
      b.dataset.cat = c.id;
      b.innerHTML = '<span class="lib-rail-icon">' + c.icon + '</span>' +
        '<span class="lib-rail-label">' + c.name + '</span>' +
        '<span class="lib-rail-count">' + (c.count || 0) + '</span>';
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
  // The bodies endpoint returns every category this tier may see, in one
  // response. So this is really "load the corpus once" — the per-category
  // bookkeeping just lets the rest of the file stay category-shaped.
  let bodiesPromise = null;

  function loadTexts(cat) {
    if (state.texts[cat]) return Promise.resolve(state.texts[cat]);
    if (!bodiesPromise) {
      bodiesPromise = fetch(BACKEND_URL + '/library/bodies', {
        headers: backendHeaders(),
      })
        .then(r => r.ok ? r.json() : {})
        .then(d => {
          const all = (d && d.bodies) || {};
          Object.keys(all).forEach(k => { state.texts[k] = all[k]; });
          return all;
        })
        .catch(() => ({}));
    }
    return bodiesPromise.then(all => state.texts[cat] || []);
  }

  // Warm the corpus in the background so full-text search works without
  // blocking first paint.
  let warmed = false;
  function warmAll() {
    if (warmed) return;
    warmed = true;
    loadTexts('__all__').then(() => setTimeout(() => { warmed = false; }, 0));
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warmAll, { timeout: 2500 });
  else setTimeout(warmAll, 1500);

  /* ---------- FILTERING ---------- */
  function filtered() {
    const q = state.q;
    const out = [];
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
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
        : (total < state.items.length
          ? total.toLocaleString() + ' of ' + state.items.length.toLocaleString() + ' prompts'
          : state.items.length.toLocaleString() + ' prompts');
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
      const it = state.items[i];
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
    const it = state.items[idx];
    if (!it) return null;
    const bodies = state.texts[it.c];
    if (!bodies) return null;
    return bodies[localIdx[idx]];
  }

  function openDrawer(idx) {
    const it = state.items[idx];
    if (!it) return;
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
    const it = state.items[state.current];
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

  /* ---------- TOPBAR SEARCH BRIDGE ---------- */
  // shell.js handles the global search; make Enter land here.
  const tbSearch = $('tb-search-input');
  if (tbSearch) {
    tbSearch.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = tbSearch.value.trim();
      if (!q) return;
      const inLib = state.items.some(it => it.n.toLowerCase().indexOf(q.toLowerCase()) !== -1);
      if (inLib) {
        state.q = q.toLowerCase();
        state.shown = PAGE;
        if (search) search.value = q;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  /* ---------- BOOT ---------- */
  function applyCatalog(d) {
    state.items = d.items || [];
    state.cats = d.cats || [];
    state.tier = d.tier || 'guest';
    state.restricted = d.restricted !== false;
    state.fullTotal = d.fullTotal || state.items.length;
    state.ready = true;

    indexCats(state.cats);
    indexItems(state.items);

    if (catParam && catMeta[catParam]) {
      state.cat = catParam;
    }

    buildRail();
    if (catParam && catMeta[catParam] && railList) {
      const btn = railList.querySelector('.lib-rail-item[data-cat="' + catParam + '"]');
      if (btn) {
        railList.querySelectorAll('.lib-rail-item').forEach(b =>
          b.classList.toggle('active', b === btn));
      }
    }
    render();
    updateTierUi();
  }

  /* ---------- TIER UI ---------- */
  function updateTierUi() {
    // Search placeholder reflects what this tier can actually reach.
    if (search) {
      search.placeholder = state.restricted
        ? 'Search ' + state.items.length.toLocaleString() + ' prompts…'
        : 'Search ' + state.items.length.toLocaleString() + ' prompts…';
    }
    // Surface the Pro upsell when the tier is capped.
    const note = $('lib-tier-note');
    if (note) {
      if (state.restricted && state.fullTotal > state.items.length) {
        note.innerHTML =
          'Free library — <strong>' + state.items.length.toLocaleString() + '</strong> of ' +
          state.fullTotal.toLocaleString() + ' prompts. ' +
          '<a href="/pricing.html">Upgrade to Pro</a> for the full catalog.';
        note.classList.remove('hidden');
      } else {
        note.classList.add('hidden');
      }
    }
    const unlock = $('lib-unlock-banner');
    if (unlock) {
      unlock.classList.toggle('hidden', !state.restricted);
    }
  }

  function friendlyLibError(msg) {
    const raw = String(msg || '');
    if (/failed to fetch|networkerror|load failed/i.test(raw)) return "We couldn't reach the library. Check your connection and try again.";
    if (/returned 5\d\d/.test(raw)) return 'The library is having a moment. Please try again shortly.';
    return raw || 'Something went wrong. Please try again.';
  }

  function showError(msg) {
    msg = friendlyLibError(msg);
    const proGate = /requires a Pro plan/i.test(msg);
    if (cards) {
      cards.innerHTML =
        '<div class="lib-empty">' +
          '<h3>' + (proGate ? 'This is a Pro library' : 'The library did not load') + '</h3>' +
          '<p>' + esc(msg) + '</p>' +
          (proGate ? '<p><a class="btn btn-sm btn-warn" href="/pricing.html">See Pro</a></p>' : '<p><button type="button" class="btn btn-sm" data-act="reload">Try again</button></p>') +
        '</div>';
    }
  }

  function boot() {
    if (cards) {
      cards.innerHTML =
        '<div class="lib-empty"><h3>Loading prompts…</h3>' +
        '<p>Fetching the library for your plan.</p></div>';
    }
    fetch(BACKEND_URL + '/library', { headers: backendHeaders() })
      .then(r => {
        if (r.status === 402) throw new Error('upgrade');
        if (!r.ok) throw new Error('The library service returned ' + r.status + '.');
        return r.json();
      })
      .then(applyCatalog)
      .catch(e => {
        if (e && e.message === 'upgrade') {
          showError('The full library requires a Pro plan.');
        } else {
          showError(e && e.message ? e.message : 'Please try again in a moment.');
        }
      });
  }

  boot();
})();


document.addEventListener('click', function (e) { if (e.target && e.target.closest && e.target.closest('[data-act="reload"]')) location.reload(); });
