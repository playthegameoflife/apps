/* ============================================================
   APP SHELL BEHAVIOUR — Prompt Helper
   Sidebar, theme toggle, library grid, global search.
   ============================================================ */

(function () {
  const $ = (id) => document.getElementById(id);

  /* ---------- SIDEBAR ---------- */
  const sbCollapse = $('sb-collapse');
  const tbMenu = $('tb-menu');

  function setCollapsed(v) {
    document.body.classList.toggle('sidebar-collapsed', v);
    try { localStorage.setItem('phg_sb_collapsed', v ? '1' : '0'); } catch (e) {}
    if (sbCollapse) sbCollapse.textContent = v ? '›' : '‹';
  }
  try {
    if (localStorage.getItem('phg_sb_collapsed') === '1' && window.innerWidth > 860) setCollapsed(true);
  } catch (e) {}

  if (sbCollapse) sbCollapse.addEventListener('click', () => setCollapsed(!document.body.classList.contains('sidebar-collapsed')));
  if (tbMenu) tbMenu.addEventListener('click', () => document.body.classList.toggle('sidebar-open'));

  // Mobile drawer: a visible scrim so the open sidebar reads as an overlay
  // (and gives a big, obvious tap target to dismiss it).
  const scrim = document.createElement('div');
  scrim.className = 'sb-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.appendChild(scrim);
  scrim.addEventListener('click', () => document.body.classList.remove('sidebar-open'));

  // close mobile drawer when a nav link is tapped
  document.querySelectorAll('.sidebar .sb-link').forEach(a => {
    a.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 860) return;
    if (!document.body.classList.contains('sidebar-open')) return;
    const sb = $('sidebar');
    if (sb && !sb.contains(e.target) && e.target !== tbMenu) document.body.classList.remove('sidebar-open');
  });

  /* ---------- THEME ---------- */
  const tbTheme = $('tb-theme');
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('phg_theme', t); } catch (e) {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'dark' ? '#131312' : '#F7F5F2');
  }
  if (tbTheme) tbTheme.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));

  /* ---------- GLOBAL SEARCH ---------- */
  const search = $('tb-search-input');
  if (search) {
    search.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = search.value.trim();
      if (!q) return;
      // 1) local library match
      const lib = document.querySelector('.lib-card[data-text*="' + q.toLowerCase() + '"]');
      if (lib) { lib.scrollIntoView({ behavior: 'smooth', block: 'center' }); lib.click(); return; }
      // 2) history match
      const hi = Array.from(document.querySelectorAll('#history-list .history-item'))
        .find(el => el.textContent.toLowerCase().includes(q.toLowerCase()));
      if (hi) { hi.scrollIntoView({ behavior: 'smooth', block: 'center' }); hi.click(); return; }
      // 3) fall back to blog search
      window.location.href = '/blog.html?q=' + encodeURIComponent(q);
    });
  }

  /* ---------- PROMPT LIBRARY GRID ---------- */
  const LIB = {
    Text: [
      { t: 'Write a cold outreach email to a potential client about our new product', s: 'Sales' },
      { t: 'Create an outline for a blog post about AI productivity tools', s: 'Marketing' },
      { t: 'Summarize a meeting transcript into action items and decisions', s: 'Operations' },
      { t: 'Write a compelling product description for a smart water bottle', s: 'Product' },
      { t: 'Prepare for a job interview by anticipating likely questions', s: 'Career' },
      { t: 'Turn meeting notes into a clear follow-up email', s: 'Productivity' },
      { t: 'Draft a polite request for an extension on a deadline', s: 'Business' },
      { t: 'Break a complex research topic into a step-by-step study plan', s: 'Learning' },
    ],
    Code: [
      { t: 'A function that sorts an array of objects by a date field', s: 'JavaScript' },
      { t: 'Create a REST API endpoint for user registration with validation', s: 'Backend' },
      { t: 'A reusable React button component with variants and loading state', s: 'React' },
      { t: 'Write a SQL query to find top 10 customers by revenue this month', s: 'SQL' },
      { t: 'A Python script that batch-resizes images in a folder', s: 'Python' },
      { t: 'Unit tests for a debounce utility function', s: 'Testing' },
      { t: 'Refactor this function to be readable and add JSDoc comments', s: 'Refactoring' },
      { t: 'A database migration adding an index to a slow query table', s: 'DevOps' },
    ],
    Image: [
      { t: 'A futuristic city at sunset with flying cars and neon lights', s: 'Sci-Fi' },
      { t: 'Professional headshot of a confident entrepreneur in a modern office', s: 'Portrait' },
      { t: 'Minimalist product photo of a wireless earbud on a marble surface', s: 'Product' },
      { t: 'A magical forest with glowing mushrooms and a misty river', s: 'Fantasy' },
      { t: 'Bioluminescent jellyfish drifting through a deep ocean trench', s: 'Nature' },
      { t: 'Isometric illustration of a cozy coffee shop interior', s: 'Illustration' },
      { t: 'A weathered fisherman mending nets on a wooden dock at dawn', s: 'Cinematic' },
      { t: 'Studio product shot of a matte black espresso machine on a seamless backdrop', s: 'Commercial' },
    ],
    Video: [
      { t: 'Cinematic drone shot of a futuristic city at golden hour', s: 'Cinematic' },
      { t: 'A 15-second ad for a new smartphone showing its camera features', s: 'Commercial' },
      { t: 'A sweeping nature documentary shot of a whale breaching', s: 'Documentary' },
      { t: 'An anime-style action scene with a hero charging forward', s: 'Animation' },
      { t: 'Slow-motion coffee pour in a sunlit cafe, steam rising', s: 'Food' },
      { t: 'Aerial flyover of autumn forest with fog in the valleys', s: 'Nature' },
      { t: 'Timelapse of a city street from night into morning', s: 'Timelapse' },
      { t: 'Tracking shot following a runner through a neon-lit underpass', s: 'Sports' },
    ],
  };
  const MODE_FOR_CAT = { Text: 'TEXT_ENHANCEMENT', Code: 'CODE_ENHANCEMENT', Image: 'IMAGE_ENHANCEMENT', Video: 'VIDEO_ENHANCEMENT' };
  const STYLE_FOR_CAT = { Text: 'detailed', Code: 'comprehensive', Image: 'cinematic', Video: 'cinematic' };

  const libGrid = $('lib-grid');
  const libTabs = $('lib-tabs');
  function renderLib(cat) {
    if (!libGrid) return;
    libGrid.innerHTML = LIB[cat].map(item =>
      '<button class="lib-card" data-text="' + item.t.toLowerCase() + '" data-prompt="' + item.t.replace(/"/g, '&quot;') + '" data-mode="' + MODE_FOR_CAT[cat] + '" data-style="' + STYLE_FOR_CAT[cat] + '">' +
        '<span class="lib-tag">' + item.s + '</span>' +
        '<span class="lib-text">' + item.t + '</span>' +
        '<span class="lib-use">Use this prompt →</span>' +
      '</button>'
    ).join('');
    libGrid.querySelectorAll('.lib-card').forEach(c => {
      c.addEventListener('click', () => {
        const inp = $('prompt-input');
        if (inp) { inp.value = c.dataset.prompt; inp.focus(); }
        // switch mode + style if the generator exposes them
        const modeTab = document.querySelector('.mode-tab[data-mode="' + c.dataset.mode + '"]');
        if (modeTab) modeTab.click();
        const sel = $('style-select');
        if (sel && Array.from(sel.options).some(o => o.value === c.dataset.style)) {
          sel.value = c.dataset.style;
          sel.dispatchEvent(new Event('change'));
        }
        document.getElementById('generator').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
  if (libTabs) {
    libTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.lib-tab');
      if (!btn) return;
      libTabs.querySelectorAll('.lib-tab').forEach(b => b.classList.toggle('active', b === btn));
      renderLib(btn.dataset.cat);
    });
    renderLib('Text');
  }

  /* ---------- DEEP LINKS: ?mode=CODE&style=expert ----------
     Handled in generate.js, which owns the mode/style state and builds the
     .mode-tab buttons. shell.js loads after generate.js but its IIFE runs at
     parse time, so the tabs do not exist yet when this script executes. */

  /* ---------- SIDEBAR ACCOUNT MIRROR ---------- */
  // The sidebar account controls exist on every page, but only the
  // generator page loads generate.js. So the sidebar reads auth state
  // from the shared auth module (auth.js) when it is available, and
  // falls back to the generator page's #user-label element otherwise.
  function isSignedIn() {
    if (window.PHGAuth && typeof window.PHGAuth.getUser === 'function') {
      const u = window.PHGAuth.getUser();
      if (u) return true;
    }
    const label = $('user-label');
    return !!(label && /@/.test(label.textContent));
  }
  function isPro() {
    const plan = $('plan-pill');
    if (plan) return plan.textContent.trim() === 'Pro';
    // No #plan-pill on this page: ask the shared module's stored user.
    try {
      const u = window.PHGAuth && window.PHGAuth.getUser();
      return !!(u && u.isPro);
    } catch (e) { return false; }
  }
  function mirrorAccount() {
    const note = $('sb-plan-note');
    const pro = isPro();
    if (note) note.textContent = pro ? 'Pro plan · unlimited enhancements' : 'Free plan · 5 enhancements/week';
    const signedIn = isSignedIn();
    const sbIn = $('sb-signin'), sbOut = $('sb-signout');
    if (sbIn) sbIn.classList.toggle('hidden', signedIn);
    if (sbOut) sbOut.classList.toggle('hidden', !signedIn);
  }
  setInterval(mirrorAccount, 700);

  // Sign-in is owned by auth.js. The old implementation delegated to a
  // #signin-btn element, which only exists on the generator page — so the
  // sidebar buttons on the library page were dead no-ops. Call PHGAuth
  // directly and fall back to the hidden button only if the module is
  // missing.
  function triggerSignIn() {
    if (window.PHGAuth && typeof window.PHGAuth.signIn === 'function') {
      window.PHGAuth.signIn().catch(() => {});
      return;
    }
    const b = $('signin-btn'); if (b) b.click();
  }
  function triggerSignOut() {
    if (window.PHGAuth && typeof window.PHGAuth.signOut === 'function') {
      window.PHGAuth.signOut();
      return;
    }
    const b = $('signout-btn'); if (b) b.click();
  }

  const sbSignin = $('sb-signin');
  const sbSignout = $('sb-signout');
  const sbSigninTop = $('sb-signin-top');
  if (sbSignin) sbSignin.addEventListener('click', triggerSignIn);
  if (sbSigninTop) sbSigninTop.addEventListener('click', triggerSignIn);
  if (sbSignout) sbSignout.addEventListener('click', triggerSignOut);
})();
