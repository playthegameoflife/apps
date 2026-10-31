// Prompt Generator web app logic (enhanced)
const BACKEND_URL = 'https://api-clyep56cdq-uc.a.run.app';
const STRIPE_MONTHLY_PRICE_ID = 'price_1SuFV7GdisCqoeFIRmlo7yb2';
const STRIPE_WEEKLY_PRICE_ID = 'price_1UWcHNGdisCqoeFID7u5xd2H';   // $4.99 / week
const STRIPE_ANNUAL_PRICE_ID = 'price_1UWcHeGdisCqoeFICCbuliDL';   // $199 / year
const PRICE_IDS = { weekly: STRIPE_WEEKLY_PRICE_ID, monthly: STRIPE_MONTHLY_PRICE_ID, annual: STRIPE_ANNUAL_PRICE_ID };
const STRIPE_PRICE_ID = STRIPE_MONTHLY_PRICE_ID;
// NOTE: the Google OAuth client id used to live here. It was the Chrome
// extension's client, which Google rejects for web origins (origin_mismatch).
// OAuth client ids now live in auth-config.js and are managed by auth.js.

// Tier limits. These MIRROR the server's limits in functions/quota.js — the
// server is authoritative (it enforces), these drive the UI. If they drift,
// the server still wins and the UI corrects itself on the next response.
const TIERS = {
  guest: { label: 'Free', limit: 5,  memory: false, abVariants: false, fullHistory: false },
  free:  { label: 'Free', limit: 10, memory: true,  abVariants: false, fullHistory: false },
  pro:   { label: 'Pro',  limit: Infinity, memory: true, abVariants: true, fullHistory: true },
};

// Kept for backwards compatibility with anything that referenced it.
const FREE_LIMIT = TIERS.guest.limit;

// Turns raw network/server errors into something a person can act on.
function friendlyError(e, what) {
  const raw = String((e && e.message) || e || '');
  const status = e && e.status;
  const action = what || 'that';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw) || (e && e.name === 'TypeError')) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  if (status === 401 || status === 403 || /unauthor|forbidden/i.test(raw)) {
    return 'Your session may have expired. Please sign in again and retry.';
  }
  if (status === 429) return 'Too many requests right now. Please wait a moment and try again.';
  if (status >= 500 || /^HTTP 5\d\d$/.test(raw)) {
    return 'Something went wrong on our side while ' + action + '. Please try again in a moment.';
  }
  if (raw === 'empty_result') return "We didn't get a result back. Please try again.";
  if (/^HTTP \d+$/.test(raw) || !raw) return 'Something went wrong. Please try again.';
  return raw;
}


let state = {
  userId: null,
  user: null,
  isPro: false,
  tier: 'guest',          // 'guest' | 'free' | 'pro' — authoritative tier
  usage: null,            // server-reported usage { used, limit, remaining }
  pendingUpgrade: false,
  mode: 'TEXT_ENHANCEMENT',
  style: 'default',
  target: '',
  weeklyUsage: { weekStart: null, enhancements: 0 },
  history: [],
  memory: { notes: '', use: true },
  lastOutput: '',
  lastPrompt: '',
};

// ---- storage ----
function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function getWeekStart() {
  const now = new Date(); const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff)).toDateString();
}
function loadState() {
  state.userId = lsGet('phg_userId', null);
  state.user = lsGet('phg_user', null);
  state.history = lsGet('phg_history', []);
  state.memory = lsGet('phg_memory', { notes: '', use: true });
  const wu = lsGet('phg_weeklyUsage', null);
  const cur = getWeekStart();
  if (wu && wu.weekStart === cur) state.weeklyUsage = wu;
  else state.weeklyUsage = { weekStart: cur, enhancements: 0 };
  if (!state.userId) {
    state.userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    lsSet('phg_userId', state.userId);
  }
}

// A durable, per-browser identifier for the guest allowance.
//
// The server keys anonymous usage by this id rather than by IP, so that
// people behind a shared connection (an office, a school, a mobile
// carrier) each get their own guest allowance, and so that the guest
// usage can be carried into the account when the visitor signs in.
//
// It is a random local id, not a credential: it grants nothing on its
// own, and the server still enforces every limit.
function getAnonId() {
  let id = null;
  try { id = localStorage.getItem('phg_anon_id'); } catch {}
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 12);
    id = String(rand).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
    try { localStorage.setItem('phg_anon_id', id); } catch {}
  }
  return id;
}
function saveUsage() { lsSet('phg_weeklyUsage', state.weeklyUsage); }
function saveHistory() { lsSet('phg_history', state.history.slice(0, 100)); }
function saveMemory() { lsSet('phg_memory', state.memory); }

// Build the headers for a backend call.
//
// The access token identifies a signed-in account; the anon id identifies
// this browser so the guest allowance is per-browser and can be carried
// into the account on sign-in. Both are always sent — the server decides
// which one applies.
function backendHeaders(extra) {
  const headers = Object.assign({}, extra || {});
  const token = window.PHGAuth && window.PHGAuth.getAccessToken
    ? window.PHGAuth.getAccessToken()
    : null;
  if (token) headers['x-phg-access-token'] = token;
  headers['x-phg-anon-id'] = getAnonId();
  return headers;
}

// ---- ui helpers ----
const $ = (id) => document.getElementById(id);
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }
function setText(id, t) { const e = $(id); if (e) e.textContent = t; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderUsage() {
  // Prefer the server's number — the local counter is only a hint.
  const limit = state.tier === 'pro' ? '∞' : (state.usage ? state.usage.limit : TIERS[state.tier].limit);
  const cur = state.usage ? state.usage.used : state.weeklyUsage.enhancements;
  // Say what is left, not a fraction: "4 of 5 free enhancements left" reads
  // the same whether the person is a guest (5) or signed in (10).
  setText('usage-label', limit === '∞'
    ? 'Unlimited enhancements'
    : `${Math.max(0, limit - cur)} of ${limit} free enhancements left this week`);
  const numericLimit = (limit === '∞') ? Infinity : limit;
  const pct = numericLimit === Infinity ? 100 : Math.min(100, (cur / numericLimit) * 100);
  const f = $('usage-fill'); if (f) f.style.width = pct + '%';
  document.body.classList.toggle('near-limit', numericLimit !== Infinity && (numericLimit - cur) <= 1);
  renderUsageNudge(cur, numericLimit);
  applyQuotaGate(cur, numericLimit);
}

/**
 * Disable Generate once the weekly allowance is spent.
 *
 * The button used to stay enabled at 0 remaining. A user could click it,
 * wait for a network round-trip, and only then get the 402 back. The
 * server is still authoritative — this is purely a UI shortcut so the
 * dead end is visible before the click, not after it.
 */
function applyQuotaGate(used, limit) {
  const btn = $('generate-btn');
  if (!btn) return;
  const exhausted = limit !== Infinity && used >= limit;

  // Never fight an in-flight request: generate() disables the button
  // itself while it runs and re-enables it in a finally block.
  if (btn.dataset.busy === '1') return;

  btn.disabled = exhausted;
  btn.classList.toggle('is-exhausted', exhausted);

  if (exhausted) {
    btn.dataset.exhaustedLabel = btn.dataset.exhaustedLabel || btn.innerHTML;
    btn.innerHTML = 'Limit reached';
    btn.setAttribute('aria-disabled', 'true');
  } else {
    if (btn.dataset.exhaustedLabel) {
      btn.innerHTML = btn.dataset.exhaustedLabel;
      delete btn.dataset.exhaustedLabel;
    }
    btn.removeAttribute('aria-disabled');
  }
}

// The upgrade moment. A user who is close to the limit but not over it is
// the highest-converting moment to offer the upgrade, and the first time a
// guest sees the reason to sign in.
function renderUsageNudge(used, limit) {
  const nudge = $('usage-nudge');
  if (!nudge) return;
  if (state.tier === 'pro' || limit === Infinity) { hide(nudge); return; }

  const remaining = Math.max(0, limit - used);
  const tier = TIERS[state.tier];

  if (remaining === 0) {
    show(nudge);
    nudge.className = 'usage-nudge warn';
    // Kept short on purpose. The nudge sits in a narrow sidebar card,
    // and the old copy ran to three sentences, which left the button
    // with no room and pushed it out of the card.
    setText('usage-nudge-text',
      state.tier === 'guest'
        ? `You've used all ${limit} free enhancements this week. Go Pro for unlimited.`
        : `You've used all ${limit} free enhancements this week. Upgrade to Pro for unlimited.`);
    setText('usage-nudge-cta', 'Upgrade to Pro');
    return;
  }

  // Warn at 80% — the last chance to act before hitting the wall.
  if (remaining <= Math.max(1, Math.ceil(limit * 0.2))) {
    show(nudge);
    nudge.className = 'usage-nudge warn';
    setText('usage-nudge-text',
      state.tier === 'guest'
        ? `${remaining} free enhancement${remaining === 1 ? '' : 's'} left this week. Go Pro for unlimited.`
        : `${remaining} enhancement${remaining === 1 ? '' : 's'} left this week. Upgrade to Pro for unlimited.`);
    setText('usage-nudge-cta', 'Upgrade to Pro');
    return;
  }

  // Signed-in free users get a gentle reminder of what Pro adds.
  if (state.tier === 'free' && !tier.fullHistory) {
    show(nudge);
    nudge.className = 'usage-nudge soft';
    setText('usage-nudge-text', 'Pro adds full history, unlimited enhancements and A/B variants.');
    setText('usage-nudge-cta', 'See Pro');
    return;
  }

  hide(nudge);
}

/** Which tier the UI should render for. Derived from auth + Pro status. */
function currentTier() {
  if (state.isPro) return 'pro';
  return state.user ? 'free' : 'guest';
}

/**
 * Ask the backend what tier we are on and how much is left.
 * The server is authoritative; this keeps the UI honest.
 */
async function refreshUsage() {
  try {
    const headers = backendHeaders({ 'Content-Type': 'application/json' });

    const r = await fetch(BACKEND_URL + '/usage-status', { headers });
    if (!r.ok) return;
    const d = await r.json();
    if (d.tier) {
      state.tier = d.tier;
      state.isPro = d.tier === 'pro';
    }
    if (d.features) state.features = d.features;
    if (d.enhancements) state.usage = d.enhancements;
    renderPlan();
    renderUsage();
    renderFeatureGates();
  } catch (e) {
    // Offline or backend down — keep whatever we already had.
  }
}

/**
 * Apply the tier gates to the UI: which features are available and what
 * happens when a locked feature is clicked.
 */
function renderFeatureGates() {
  const tier = TIERS[currentTier()];
  const memToggle = $('memory-toggle');
  const memInput = $('memory-input');
  const abToggle = $('ab-toggle');

  if (memToggle) {
    memToggle.disabled = !tier.memory;
    memToggle.title = tier.memory ? '' : 'Sign in free to use Memory';
  }
  if (memInput) {
    memInput.disabled = !tier.memory;
    memInput.placeholder = tier.memory
      ? 'e.g. Concise, technical, always include an output format.'
      : 'e.g. Concise, technical, always include an output format.';
    memInput.title = tier.memory ? '' : 'Memory is free with an account';
  }
  const memSave = $('save-memory-btn');
  if (memSave) {
    memSave.disabled = !tier.memory;
    memSave.textContent = 'Save memory';
  }
  if (abToggle) {
    // A/B variants are a Pro feature. Free and Guest tiers see the control
    // but cannot switch it on — hiding it entirely would make the Pro
    // upsell invisible.
    abToggle.disabled = !tier.abVariants;
    abToggle.title = tier.abVariants ? '' : 'Upgrade to Pro to compare A/B variants';
    if (!tier.abVariants && abToggle.checked) {
      abToggle.checked = false;
    }
    // Show a PRO badge next to the control while it is locked, so the
    // upsell is visible without adding clutter to the Pro experience.
    const abBadge = $('ab-pro-badge');
    if (abBadge) abBadge.hidden = tier.abVariants;
  }
}
/**
 * Adopt a quota response from the server so the UI always reflects the
 * authoritative counter, even if our local guess was stale.
 */
function applyQuotaFromServer(q) {
  if (!q) return;
  if (q.limit !== undefined && q.limit !== null) {
    state.usage = { used: q.used || 0, limit: q.limit, remaining: q.remaining };
  }
  if (q.tier) {
    state.tier = q.tier;
    state.isPro = q.tier === 'pro';
  }
  renderUsage();
  renderPlan();
  renderFeatureGates();
}

/**
 * Show the "you hit the limit" state with a real next action, instead of
 * the old dead-end message that offered no way to act.
 */
function showQuotaLimit(q) {
  const el = $('gen-error');
  if (!el) return;
  const tier = q && q.tier ? q.tier : currentTier();
  const limit = q && q.limit !== undefined ? q.limit : TIERS[tier].limit;

  // This used to be one long paragraph with the actions as inline
  // links. On narrow screens the links wrapped away from the sentence
  // and the "Sign in" action ended up pushed onto its own line,
  // separated from the message it belonged to, which read as a
  // broken layout.
  //
  // It is now a proper panel: a headline, a short explanation, and the
  // two actions as real buttons in a row that wraps cleanly.
  const canUpgrade = tier !== 'pro';
  const actions = [];
  if (tier === 'guest') {
    actions.push(`<button type="button" id="quota-signin" class="btn btn-sm btn-primary">Sign in free</button>`);
  }
  if (canUpgrade) {
    actions.push(`<button type="button" id="quota-upgrade" class="btn btn-sm btn-warn">Go Pro</button>`);
  }

  const body = tier === 'guest'
    ? `Sign in free to get ${TIERS.free.limit} a week, plus Memory.`
    : `Upgrade to Pro for unlimited enhancements, A/B variants, and full history.`;

  el.innerHTML = `
    <div class="quota-panel" role="alert">
      <div class="quota-panel-head">
        <span class="quota-panel-icon" aria-hidden="true">&#9679;</span>
        <span class="quota-panel-title">You've used all ${limit} free enhancements this week</span>
      </div>
      <p class="quota-panel-body">${body}</p>
      <div class="quota-panel-actions">${actions.join('')}</div>
    </div>`;
  el.classList.remove('hidden');

  // Keep the button state in sync: the user is out of credits whether we
  // learned that from a 402 or from /usage-status.
  applyQuotaGate(limit, limit);

  const s = document.getElementById('quota-signin');
  if (s) s.addEventListener('click', (e) => { e.preventDefault(); signIn(); });
  const u = document.getElementById('quota-upgrade');
  if (u) u.addEventListener('click', (e) => { e.preventDefault(); upgrade(); });
}

function renderPlan() {
  // Refresh the Pro badge on the App builder menu item.
  try { if ($('mode-tabs') && $('mode-tabs').firstChild) populateModes(); } catch (e) {}
  const pill = $('plan-pill');
  const badge = $('plan-badge');
  if (state.isPro) {
    if (pill) { pill.textContent = 'Pro'; pill.className = 'status-pill pro'; }
    if (badge) { badge.textContent = 'Pro'; badge.style.background = ''; badge.style.color = ''; }
    hide($('upgrade-btn')); show($('portal-btn'));
  } else {
    if (pill) { pill.textContent = state.user ? 'Free' : 'Guest'; pill.className = 'status-pill free'; }
    if (badge) { badge.textContent = 'Free'; badge.style.background = ''; badge.style.color = ''; }
    show($('upgrade-btn')); hide($('portal-btn'));
  }
  if (state.user) {
    setText('user-label', state.user.displayName || state.user.email || 'Signed in');
    { const ul0 = $('user-label'); if (ul0) delete ul0.dataset.guest; }
    { const ul = $('user-label'); if (ul) ul.title = state.user.email || ''; }
    show($('signout-btn')); hide($('signin-btn')); hide($('plan-meta-signin'));
  } else {
    // The old copy said "Not signed in - using guest mode", which
    // described the visitor's account state inside the Free plan card
    // and made the pricing table read like a debug panel rather than
    // a price list. The plan card now says what the plan includes;
    // the sign-in control below carries the account state on its own.
    setText('user-label', 'Sign in to get 10 enhancements a week');
    { const ul = $('user-label'); if (ul) ul.dataset.guest = '1'; }
    show($('signin-btn')); hide($('signout-btn')); show($('plan-meta-signin'));
  }
}
function renderMemory() {
  const inp = $('memory-input'); if (inp) inp.value = state.memory.notes;
  const t = $('memory-toggle'); if (t) t.checked = state.memory.use;
}



// ---- modes/styles ----
const MODE_HINTS = { TEXT_ENHANCEMENT: 'Emails, plans, answers', CODE_ENHANCEMENT: 'Functions, bugs, features', IMAGE_ENHANCEMENT: 'Midjourney, DALL·E, Flux', VIDEO_ENHANCEMENT: 'Sora, Veo, Runway', APP_ENHANCEMENT: 'Lovable, Bolt, Replit, Cursor' };
let modeMenuBound = false;
function populateModes() {
  const tabs = $('mode-tabs');
  const cur = MODES.find(m => m.key === state.mode) || MODES[0];
  tabs.innerHTML = '<button type="button" class="mode-trigger" id="mode-trigger" aria-haspopup="true" aria-expanded="false" aria-controls="mode-menu"><span class="mode-trigger-k">Make a prompt for</span> <b>' + cur.label + '</b><svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '<div class="mode-menu" id="mode-menu" role="group" aria-label="Prompt type" hidden>' +
    MODES.map(m => { const locked = m.key === 'APP_ENHANCEMENT' && !state.isPro; return `<button type="button" class="mode-tab ${m.key === state.mode ? 'active' : ''}${locked ? ' is-locked' : ''}" data-mode="${m.key}"${locked ? ' disabled aria-disabled="true" title="App builder is a Pro feature"' : ''}><span>${m.label}${locked ? ' <em class="mode-pro">Pro</em>' : ''}</span><small>${MODE_HINTS[m.key] || ''}</small></button>`; }).join('') + '</div>';
  const trig = $('mode-trigger'), menu = $('mode-menu');
  const setOpen = (o) => { menu.hidden = !o; trig.setAttribute('aria-expanded', o ? 'true' : 'false'); };
  trig.addEventListener('click', (e) => { e.stopPropagation(); setOpen(menu.hidden); });
  if (!modeMenuBound) {
    modeMenuBound = true;
    document.addEventListener('click', (e) => { const m = $('mode-menu'); if (m && !m.hidden && !e.target.closest('#mode-tabs')) { m.hidden = true; $('mode-trigger').setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', (e) => { const m = $('mode-menu'); if (e.key === 'Escape' && m && !m.hidden) { m.hidden = true; const t = $('mode-trigger'); t.setAttribute('aria-expanded', 'false'); t.focus(); } });
  }
  tabs.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      populateModes();
      populateStyles(state.mode);
      const m = MODES.find(x => x.key === state.mode);
      if (m) $('prompt-input').placeholder = m.placeholder;
      renderExampleChips();
    });
  });
}
/**
 * Apply a mode/style/target deep link to the generator.
 *
 * Used in two places:
 *   1. On load, for /?mode=IMAGE&style=expert&target=Claude
 *   2. When the visitor clicks a "Start with a mode" card
 *
 * Every parameter is optional and every one is validated against the
 * real <option> / .mode-tab list before it is applied, so a stale link
 * can never leave the generator in an impossible state. Anything that
 * does not match is simply ignored.
 */
function applyDeepLink(params, opts) {
  if (!params) return;
  const resetTarget = !!(opts && opts.resetTarget);

  // --- mode ---
  const modeParam = params.get('mode');
  if (modeParam) {
    const map = {
      TEXT: 'TEXT_ENHANCEMENT',
      CODE: 'CODE_ENHANCEMENT',
      IMAGE: 'IMAGE_ENHANCEMENT',
      VIDEO: 'VIDEO_ENHANCEMENT',
      APP: 'APP_ENHANCEMENT',
    };
    const key = map[modeParam.toUpperCase()] || modeParam;
    const tab = document.querySelector('.mode-tab[data-mode="' + key + '"]');
    // Clicking the tab is what rebuilds the style list for that mode,
    // so it has to happen before the style parameter is applied.
    if (tab) tab.click();
  }

  // --- style ---
  const styleParam = params.get('style');
  if (styleParam) {
    const sel = $('style-select');
    if (sel && Array.from(sel.options).some(o => o.value === styleParam)) {
      sel.value = styleParam;
      sel.dispatchEvent(new Event('change'));
      state.style = styleParam;
    }
  }

  // --- target platform ---
  // The "Start with a mode" cards are named after a platform, so landing
  // on one should actually set the platform dropdown. Previously the card
  // set a mode and style but left the target on "General", which did not
  // match what the card promised.
  const targetParam = params.get('target');
  const tsel = $('target-select');
  if (targetParam) {
    if (tsel && Array.from(tsel.options).some(o => o.value === targetParam)) {
      tsel.value = targetParam;
      tsel.dispatchEvent(new Event('change'));
    }
  } else if (resetTarget && tsel) {
    // The card did not name a platform, so clear any platform left
    // over from a previous card. Otherwise clicking "Video Prompt
    // Generator" could land on "Video + Midjourney" because the last
    // card the visitor clicked was the image one.
    tsel.value = '';
    tsel.dispatchEvent(new Event('change'));
  }
}

function populateStyles(mode) {
  const sel = $('style-select');
  const styles = getStylesForMode(mode);
  sel.innerHTML = styles.map(s => `<option value="${s}">${STYLE_LABELS[s] || s}</option>`).join('');
  if (styles.includes(state.style)) sel.value = state.style;
  else { state.style = styles[0]; sel.value = state.style; }
  sel.onchange = () => { state.style = sel.value; };
}


// ---- auth ----
// Sign-in lives in auth.js (shared, Authorization Code + PKCE). The old
// inline implementation used the Chrome extension's OAuth client, which
// Google rejects for web origins, so sign-in failed on every page.
async function signIn() {
  if (!window.PHGAuth) { setText('auth-msg', 'Sign-in is unavailable on this page.'); return; }
  try {
    await window.PHGAuth.signIn();
  } catch (e) {
    if (!e || e.code !== 'no_authorized_client') {
      const code = e && (e.code || e.message);
      const nice = {
        popup_blocked: 'Your browser blocked the sign-in window. Allow pop-ups for this site and tap Sign in again.',
        timeout: 'Sign-in took too long. Please try again.',
        state_mismatch: 'Sign-in could not be verified. Please try again.',
        no_token: 'Google did not complete the sign-in. Please try again.',
        access_denied: 'Sign-in was cancelled. You can try again any time.'
      }[code];
      setText('auth-msg', nice || friendlyError(e, 'signing you in'));
    }
  }
}
function signOut() {
  state.user = null; lsSet('phg_user', null);
  state.userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  lsSet('phg_userId', state.userId); state.isPro = false;
  // Drop back to the guest tier and clear the cached server meter so the
  // UI stops showing the signed-in allowance.
  state.tier = 'guest';
  state.usage = null;
  if (window.PHGAuth) window.PHGAuth.signOut();
  renderPlan(); renderUsage(); renderFeatureGates();
  setText('auth-msg', 'Signed out.');
}
// Called when the shared auth module reports a session change.
function onAuthChanged(user) {
  state.user = user;
  if (user && user.uid) state.userId = user.uid;
  renderPlan();
  // The server now owns quota + tier, so ask it rather than computing
  // locally. This also picks up a Pro upgrade made on another device.
  refreshUsage();
  if (user && state.pendingUpgrade) { state.pendingUpgrade = false; upgrade(); }
}

// ---- subscription ----
async function checkSubscription() {
  try {
    const headers = backendHeaders();
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId), { headers });
    if (!r.ok) { state.isPro = false; return; }
    const d = await r.json(); state.isPro = !!d.active;
  } catch { state.isPro = false; }
}

// ---- usage ----
// The local counter is kept only as an offline fallback / optimistic hint.
// The server counter in Firestore is authoritative.
function canUse() {
  if (state.isPro) return { allowed: true };
  if (state.usage && state.usage.remaining !== undefined) {
    return { allowed: state.usage.remaining > 0, remaining: state.usage.remaining };
  }
  const cur = state.weeklyUsage.enhancements;
  const limit = TIERS[currentTier()].limit;
  return { allowed: cur < limit, remaining: Math.max(0, limit - cur) };
}
function trackUsage() {
  state.weeklyUsage.weekStart = getWeekStart();
  state.weeklyUsage.enhancements++;
  saveUsage();
}

// ---- build system instruction ----
function buildSystemInstruction(mode, style, target, memoryNotes) {
  let sys = getSystemInstruction(mode, style);
  if (target) sys += `\n\nOptimize this prompt specifically for use with ${target}. Tailor formatting, syntax, and conventions to that platform's best practices.`;
  if (state.memory.use && memoryNotes && memoryNotes.trim()) {
    sys += `\n\nUser preferences (apply these): ${memoryNotes.trim()}`;
  }
  if (state.lastOutput && state.refineMode) {
    sys += `\n\nPrevious version of this prompt:\n"${state.lastOutput}"\nImprove and refine it further based on the new input.`;
  }
  return sys;
}

// ---- streaming generate ----
async function streamEnhance(prompt, systemInstruction, onChunk, onDone, onError) {
  try {
    // Send the Google access token so the backend can identify the caller
    // and enforce the quota against the right account. Without it the
    // request is treated as an anonymous guest.
    const headers = backendHeaders({ 'Content-Type': 'application/json' });

    const r = await fetch(BACKEND_URL + '/enhance-stream', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt,
        systemInstruction,
        // One logical action = one credit. A/B variants send the SAME
        // logicalId so they cost 1, not 2.
        logicalId: state.currentLogicalId || null,
        // Ask the server to enforce the tier gates, not just the client.
        features: state.currentFeatures || null,
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      const err = new Error(d.error || ('HTTP ' + r.status));
      err.status = r.status;
      err.payload = d;
      // The server rejected us for quota or tier reasons — surface the
      // server's own numbers rather than a generic message.
      if (d.quota) {
        err.quota = d.quota;
        applyQuotaFromServer(d.quota);
      }
      throw err;
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload) continue;
        try {
          const obj = JSON.parse(payload);
          if (obj.started) continue;
          if (obj.error) { onError(new Error(obj.error)); return; }
          // Gemini SSE chunk
          const parts = obj.candidates?.[0]?.content?.parts;
          if (parts) {
            for (const p of parts) {
              if (p.text) { full += p.text; onChunk(full); }
            }
          }

        } catch { /* skip non-json */ }
      }
    }
    if (!full.trim()) { onError(new Error('empty_result')); return; }
    onDone(full);
  } catch (e) { onError(e); }
}

let generating = false;

function addUserMessage(text) {
  const conv = document.getElementById('conversation');
  if (!conv) return;
  const div = document.createElement('div');
  div.className = 'msg user';
  div.innerHTML = '<div class="msg-avatar">You</div><div class="msg-bubble">' + escapeHtml(text) + '</div>';
  conv.appendChild(div);
  conv.style.display = 'flex';
  conv.style.flexDirection = 'column';
  conv.style.gap = 'var(--space-5)';
  const empty = document.getElementById('empty-state');
  if (empty) empty.style.display = 'none';
  // scroll to bottom
  const msgs = document.getElementById('chat-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function showAIMessage() {
  const aiMsg = document.getElementById('ai-msg');
  if (aiMsg) aiMsg.style.display = 'flex';
  const conv = document.getElementById('conversation');
  if (conv) conv.appendChild(aiMsg);
  const msgs = document.getElementById('chat-messages');
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

async function generate(variantStyle) {
  const prompt = $('prompt-input').value.trim();
  if (!prompt) { $('gen-error').textContent = 'Please enter a prompt.'; show($('gen-error')); return; }
  hide($('gen-error'));
  // App builder briefs are the longest outputs, so the mode is Pro-only.
  if (state.mode === 'APP_ENHANCEMENT' && !state.isPro) {
    const nudge = $('usage-nudge');
    if (nudge) {
      show(nudge);
      nudge.className = 'usage-nudge warn';
      setText('usage-nudge-text', 'App builder is a Pro feature. Upgrade to turn ideas into build-ready briefs.');
      setText('usage-nudge-cta', 'Upgrade to Pro');
      nudge.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return;
  }
  { const ar = $('after-result'); if (ar) ar.classList.add('hidden'); }
  // The server is authoritative on quota. We do a cheap optimistic check
  // against the last known usage so we don't waste a round trip, but the
  // real decision happens on the server.
  if (!state.isPro && state.usage && state.usage.remaining !== undefined && state.usage.remaining <= 0) {
    showQuotaLimit(state.usage);
    return;
  }
  if (generating) return;
  generating = true;
  const btn = $('generate-btn');
  btn.disabled = true;
  btn.dataset.busy = '1';
  btn.innerHTML = '<span class="spinner spinner-btn" aria-hidden="true"></span> Generating…';
  setText('gen-status', 'Writing your prompt…');
  const sys = buildSystemInstruction(state.mode, variantStyle || state.style, $('target-select').value, state.memory.notes);
  state.refineMode = false;

  // One logical action = one credit. Both A/B variants share this id, so
  // the pair costs a single enhancement.
  state.currentLogicalId = 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);

  // Tell the server which gated features this request is actually using,
  // so it can enforce the tier server-side.
  const tier = TIERS[currentTier()];
  const feats = [];
  if ($('memory-toggle') && $('memory-toggle').checked && state.memory.use && state.memory.notes) feats.push('memory');
  if ($('ab-toggle') && $('ab-toggle').checked) feats.push('abVariants');
  state.currentFeatures = feats;

  // Chat UX: show user message + AI bubble
  addUserMessage(prompt);
  const out = $('output');
  out.textContent = '';
  out.classList.remove('empty');
  out.classList.add('has-content');
  setOutputLoading(true);
  showAIMessage();
  const meta = document.getElementById('output-meta');
  if (meta) meta.innerHTML = '';
  const actions = document.getElementById('output-actions');
  if (actions) actions.innerHTML = '';

  const doOne = (style, outputEl) => new Promise((resolve) => {
    let started = false;
    streamEnhance(prompt, buildSystemInstruction(state.mode, style, $('target-select').value, state.memory.notes),
      (full) => {
        if (!started) { started = true; outputEl.classList.remove('empty'); setOutputLoading(false); }
        outputEl.textContent = full;
        const cc = $('char-count'); if (cc && outputEl === $('output')) cc.textContent = `(${full.length} chars)`;
      },
      (full) => {
        if (outputEl === $('output')) {
          const meta = document.getElementById('output-meta');
          if (meta) meta.innerHTML = '';
          const actions = document.getElementById('output-actions');
          if (actions) actions.innerHTML = '<button class="btn btn-sm btn-ghost" data-act="refine">Refine</button>';
          state.lastOutput = full; state.lastPrompt = prompt;
          trackUsage(); saveHistoryEntry(prompt, full, style);
          renderUsage();
          // Ask the server for the authoritative counter now that one has
          // been consumed. This keeps the meter honest across devices.
          refreshUsage();
          setText('gen-status', 'Done');
          setOutputLoading(false);
          renderAfterResult();
          revealOutputOnPhone();
        }
        resolve(full);
      },
      (e) => {
        setOutputLoading(false);
        // A quota rejection from the server is a normal state, not a crash:
        // show the limit with a real next action instead of a raw error.
        if (e && (e.status === 429 || e.status === 402 || e.quota)) {
          if (e.payload && e.payload.code === 'feature_requires_plan') {
            $('gen-error').textContent = e.message; show($('gen-error'));
            setText('gen-status', 'Upgrade required');
          } else {
            showQuotaLimit(e.quota || null);
            setText('gen-status', 'Limit reached');
          }
        } else {
          $('gen-error').textContent = friendlyError(e, 'generating your prompt'); show($('gen-error'));
          setText('gen-status', 'Failed');
        }
        resolve('');
      }
    );
  });

  const ab = $('ab-toggle').checked;
  if (ab) {
    show($('variants-wrap'));
    const va = $('variant-a'), vb = $('variant-b');
    va.textContent = ''; va.classList.add('empty'); vb.textContent = ''; vb.classList.add('empty');
    // variant A: current style; variant B: detailed (or first alt)
    const styles = getStylesForMode(state.mode);
    const alt = styles.includes('detailed') ? 'detailed' : (styles[1] || styles[0]);
    await Promise.all([doOne(state.style, va), doOne(alt, vb)]);
    // also put variant A into main output
    $('output').textContent = va.textContent;
    $('output').classList.remove('empty');
  } else {
    hide($('variants-wrap'));
    await doOne(state.style, $('output'));
  }

  generating = false;
  delete btn.dataset.busy;
  // Re-apply the gate: if the request that just ran used the last credit,
  // the button must stay disabled rather than springing back to life.
  btn.disabled = false;
  btn.innerHTML = '✦ Generate';
  const lim = state.tier === 'pro' ? Infinity
    : (state.usage ? state.usage.limit : TIERS[state.tier].limit);
  const used = state.usage ? state.usage.used : state.weeklyUsage.enhancements;
  applyQuotaGate(used, lim);
}

function saveHistoryEntry(prompt, result, style) {
  state.history.unshift({ mode: state.mode, style, target: $('target-select').value, prompt, result, timestamp: Date.now() });
  saveHistory();
}

// ---- refine ----
async function refine() {
  if (!state.lastOutput) return;
  $('prompt-input').value = state.lastOutput;
  state.refineMode = true;
  await generate();
  state.refineMode = false;
}

// ---- copy/share ----
function copyOutput() {
  const text = $('output').textContent;
  if (!text || $('output').classList.contains('empty')) return;
  navigator.clipboard.writeText(text).then(() => { showToast('Copied to clipboard'); setText('copy-msg', ''); const cb = $('copy-btn'); if (cb) { const t0 = cb.dataset.label || cb.textContent; cb.dataset.label = t0; cb.textContent = 'Copied ✓'; clearTimeout(cb._t); cb._t = setTimeout(() => { cb.textContent = t0; }, 1600); } }).catch(() => setText('copy-msg','Copy failed'));
}
function shareLink() {
  const prompt = encodeURIComponent($('prompt-input').value.trim());
  const url = location.origin + '/?p=' + prompt;
  navigator.clipboard.writeText(url).then(() => { showToast('Link copied'); setText('copy-msg', 'Link copied!'); setTimeout(() => setText('copy-msg',''), 1500); }).catch(() => setText('copy-msg','Copy failed'));
}

// After a successful result: one short, honest next step, based on the plan.
function renderAfterResult() {
  const box = $('after-result');
  if (!box) return;
  const tier = currentTier();
  let html = '';
  if (tier === 'guest') {
    html = '<p><strong>Like it?</strong> Sign in free to double your limit to ' + TIERS.free.limit + ' a week, plus Memory and saved history.</p>' +
           '<button type="button" class="btn btn-sm btn-primary" id="after-signin">Sign in free</button>';
  } else if (tier === 'free') {
    html = '<p><strong>Want more?</strong> Pro adds unlimited enhancements, A/B variants and your full history.</p>' +
           '<a class="btn btn-sm btn-warn" href="/pricing.html">See Pro</a>';
  } else {
    box.classList.add('hidden'); box.innerHTML = ''; return;
  }
  box.innerHTML = html;
  box.classList.remove('hidden');
  const b = $('after-signin');
  if (b) b.addEventListener('click', () => signIn());
}

function initAbUpsell() {
  const t = $('ab-toggle'); const note = $('ab-upsell');
  if (!t || !note) return;
  const label = t.closest('label');
  if (!label) return;
  label.addEventListener('click', (ev) => {
    if (ev.target && ev.target.closest && ev.target.closest('.help-dot')) return;
    if (t.disabled) { note.classList.remove('hidden'); }
  });
  t.addEventListener('change', () => { if (!t.disabled) note.classList.add('hidden'); });
}

// ---- UX polish: examples, options toggle, toast, loading state ----
const EXAMPLES = {
  TEXT_ENHANCEMENT: ['write an email about my delayed order', 'plan a 3-day trip to Lisbon', 'explain taxes to a teenager'],
  CODE_ENHANCEMENT: ['a function that checks if an email is valid', 'sort a list of users by signup date', 'debug a slow database query'],
  IMAGE_ENHANCEMENT: ['a cozy coffee shop on a rainy day', 'a futuristic city at sunset', 'a golden retriever astronaut'],
  APP_ENHANCEMENT: ['a booking site for my dog groomer', 'a habit tracker with streaks', 'a simple store for my handmade candles'],
  VIDEO_ENHANCEMENT: ['a drone flying over a forest at sunrise', 'a chef plating a dessert', 'a skateboarder at night in the city'],
};
function renderExampleChips() {
  const box = $('example-chips');
  if (!box) return;
  const inputEl = $('prompt-input');
  if (inputEl && !inputEl.dataset.chipsBound) {
    inputEl.dataset.chipsBound = '1';
    inputEl.addEventListener('input', () => { box.hidden = inputEl.value.trim().length > 0; });
    // Grow the box with the text (kept short when empty so Generate stays near the top).
    const autoGrow = () => { inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 240) + 'px'; };
    inputEl.addEventListener('input', autoGrow);
    autoGrow();
  }
  box.hidden = !!(inputEl && inputEl.value.trim());
  const list = EXAMPLES[state.mode] || EXAMPLES.TEXT_ENHANCEMENT;
  box.innerHTML = '';
  list.forEach((t) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'example-chip'; b.textContent = t;
    b.addEventListener('click', () => {
      const input = $('prompt-input');
      input.value = t; input.focus({ preventScroll: true });
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // One tap: run it. The visitor sees a real result without a second click.
      if (typeof generate === 'function') generate();
    });
    box.appendChild(b);
  });
}
function initOptionsToggle() {
  const btn = $('gen-options-toggle'); const bar = $('gen-toolbar');
  if (!btn || !bar) return;
  btn.addEventListener('click', () => {
    const open = bar.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.textContent = open ? 'Hide options' : 'More options';
  });
}
let toastTimer = null;
function showToast(msg) {
  let t = document.getElementById('phg-toast');
  if (!t) { t = document.createElement('div'); t.id = 'phg-toast'; t.className = 'phg-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}
function setOutputLoading(on) {
  const out = $('output'); if (!out) return;
  out.classList.toggle('is-loading', !!on);
}
function revealOutputOnPhone() {
  try {
    if (!window.matchMedia('(max-width: 860px)').matches) return;
    const out = $('output'); if (!out) return;
    const r = out.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.6 || r.bottom < 0) out.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {}
}

// ---- stripe ----
async function upgrade(plan) {
  // The pricing page passes the billing period the visitor picked. It is kept
  // on state so the choice survives the sign-in round trip.
  if (typeof plan === 'string' && PRICE_IDS[plan]) state.selectedPlan = plan;
  const msg = $('upgrade-msg');
  if (!state.user) {
    state.pendingUpgrade = true;
    msg.textContent = 'Sign in with Google first so Pro follows you across devices…';
    signIn();
    return;
  }
  // If user is signed in but not Pro, proceed to checkout
  // If user is signed in but not Pro, proceed to checkout
  const priceId = PRICE_IDS[state.selectedPlan] || STRIPE_MONTHLY_PRICE_ID;
  msg.textContent = 'Opening secure checkout…';
  try {
    const headers = backendHeaders({ 'Content-Type': 'application/json' });
    const r = await fetch(BACKEND_URL + '/create-checkout-session', { method:'POST', headers, body: JSON.stringify({ userId: state.userId, priceId: priceId, email: state.user ? state.user.email : undefined, successUrl: location.origin + '/success.html', cancelUrl: location.origin + '/cancel.html' }) });
    if (!r.ok) {
      const d = await r.json().catch(()=>({}));
      // 409 = this account already has a paid subscription. The server
      // refuses a second checkout so nobody is billed twice. Our own
      // status was stale, so refresh it and send them to billing.
      if (r.status === 409 && d.alreadySubscribed) {
        msg.textContent = 'You already have an active subscription — opening billing…';
        await checkSubscription();
        renderPlan();
        await portal();
        return;
      }
      throw new Error(d.error || ('HTTP ' + r.status));
    }
    const d = await r.json();
    if (d.url) window.location.href = d.url; else throw new Error('No checkout URL');
  } catch (e) { msg.textContent = friendlyError(e, 'opening checkout') + ' You have not been charged.'; }
}
async function portal() {
  const msg = $('upgrade-msg'); msg.textContent = 'Opening billing portal...';
  try {
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId), { headers: backendHeaders() });
    const d = await r.json();
    const r2 = await fetch(BACKEND_URL + '/create-portal-session', { method:'POST', headers: backendHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ userId: state.userId, customerId: d.customerId, returnUrl: location.origin + '/' }) });
    if (!r2.ok) { const dd = await r2.json().catch(()=>({})); throw new Error(dd.error || ('HTTP ' + r2.status)); }
    const dd = await r2.json();
    if (dd.url) window.location.href = dd.url; else throw new Error('No portal URL');
  } catch (e) { msg.textContent = friendlyError(e, 'opening the billing portal'); }
}

// ---- init ----
document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  initAbUpsell();
  initOptionsToggle();
  const isGeneratorPage = !!document.getElementById('mode-tabs');

  // load prompt from share link (only on generator page)
  if (isGeneratorPage) {
    const params = new URLSearchParams(location.search);
    if (params.get('p')) $('prompt-input').value = decodeURIComponent(params.get('p'));
    // Library handoff: full prompt bodies can be thousands of characters, which
    // is too long for a URL query string. The library page stores the body in
    // localStorage and passes only a key.
    try {
      const key = params.get('lib');
      if (key) {
        const raw = localStorage.getItem('phg_lib_' + key);
        if (raw) {
          const parsed = JSON.parse(raw);
          $('prompt-input').value = parsed.p || '';
          if (parsed.m) state.mode = parsed.m;
          if (parsed.s) state.style = parsed.s;
          localStorage.removeItem('phg_lib_' + key);
        }
      }
    } catch (e) {}
  }

  if (isGeneratorPage) {
    populateModes();
    renderExampleChips();
    populateStyles(state.mode);
    const m = MODES.find(x => x.key === state.mode);
    if (m) $('prompt-input').placeholder = m.placeholder;
    renderMemory();

    // Deep links: /?mode=IMAGE&style=cinematic (used by the "Start with a
    // mode" cards). This must run AFTER populateModes()/populateStyles(),
    // because those are what build the .mode-tab buttons and the style
    // <option>s that the deep link needs to target.
    applyDeepLink(new URLSearchParams(location.search));

    // The "Start with a mode" cards point at the same page with the same
    // query string. Intercept the click so the generator switches in
    // place and scrolls into view, instead of reloading the page and
    // dumping the visitor back at the top. The href is left intact so
    // the link can still be copied and shared.
    document.querySelectorAll('.tool-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Let the user open it in a new tab if they asked for that.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        const qs = card.getAttribute('href').split('?')[1];
        if (!qs) return;
        e.preventDefault();
        applyDeepLink(new URLSearchParams(qs), { resetTarget: true });
        const gen = $('generator');
        if (gen) {
          gen.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const input = $('prompt-input');
          if (input) setTimeout(() => input.focus({ preventScroll: true }), 350);
        }
        // Keep the address bar in sync so a refresh preserves the choice.
        try { history.replaceState(null, '', card.getAttribute('href')); } catch (err) {}
      });
    });

    const gb=$('generate-btn'); if(gb) gb.addEventListener('click', () => generate());
    const rb=$('refine-btn'); if(rb) rb.addEventListener('click', refine);
    const cb2=$('clear-btn'); if(cb2) cb2.addEventListener('click', () => { $('prompt-input').value = ''; $('output').textContent = 'Your enhanced prompt will appear here.'; $('output').classList.add('empty'); $('output').classList.remove('has-content'); const aiMsg = document.getElementById('ai-msg'); if (aiMsg) aiMsg.style.display = 'none'; const conv = document.getElementById('conversation'); if (conv) { conv.innerHTML = ''; conv.style.display = 'none'; } const empty = document.getElementById('empty-state'); if (empty) empty.style.display = 'flex'; $('char-count').textContent = ''; setText('gen-status', ''); });
    const cb=$('copy-btn'); if(cb) cb.addEventListener('click', copyOutput);
    const shb=$('share-btn'); if(shb) shb.addEventListener('click', shareLink);
    $('memory-toggle').addEventListener('change', (e) => { state.memory.use = e.target.checked; saveMemory(); });
    const smb=$('save-memory-btn'); if(smb) smb.addEventListener('click', () => { state.memory.notes = $('memory-input').value; saveMemory(); setText('memory-msg', 'Saved.'); setTimeout(() => setText('memory-msg',''), 1500); });
    }

  // Sign-in controls. These live on the generator page AND the pricing
  // page, so they must be wired OUTSIDE the isGeneratorPage block — they
  // used to be inside it, which left the pricing page's sign-in dead.
  const sb = $('signin-btn'); if (sb) sb.addEventListener('click', signIn);
  const so = $('signout-btn'); if (so) so.addEventListener('click', signOut);

  // Upgrade button exists on pricing page too
  const upgradeBtn = $('upgrade-btn');
  if (upgradeBtn) upgradeBtn.addEventListener('click', upgrade);
  const portalBtn = $('portal-btn');
  if (portalBtn) portalBtn.addEventListener('click', portal);

  // The usage nudge ends in a call to action. Guests get sent to sign in
  // (which buys them a bigger allowance); signed-in users get sent to the
  // upgrade flow.
  const nudgeCta = $('usage-nudge-cta');
  if (nudgeCta) nudgeCta.addEventListener('click', () => {
    // Upgrade is gated behind sign-in inside upgrade(), so guests are
    // asked to sign in first and then continue to checkout.
    upgrade();
  });
  // Pricing page: the "Free account" card has its own sign-in button, so a
  // guest can upgrade their allowance without hunting for the small
  // sign-in control in the account bar.
  const signinCta = $('signin-cta-btn');
  if (signinCta) signinCta.addEventListener('click', async () => {
    const msg = $('signin-cta-msg');
    if (state.user) {
      if (msg) msg.textContent = 'You are signed in and on the free tier.';
      return;
    }
    if (msg) msg.textContent = 'Opening Google sign-in…';
    await signIn();
  });

  await checkSubscription();
  renderPlan(); renderUsage();
  if (isGeneratorPage) renderUsage();

  // Apply the tier gates to the UI (Memory, A/B variants) and pull the
  // authoritative usage meter from the server.
  renderFeatureGates();
  refreshUsage();

  // Shared auth module (auth.js) owns the OAuth popup flow.
  if (window.PHGAuth) {
    window.PHGAuth.onChange(onAuthChanged);
    // A restored session should repaint immediately.
    const restored = window.PHGAuth.getUser();
    if (restored) onAuthChanged(restored);
  }
});


// CSP-safe delegated handlers (no inline onclick).
document.addEventListener('click', function (e) {
  var b = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
  if (!b) return;
  var out = document.getElementById('output'), inp = document.getElementById('prompt-input');
  if (b.dataset.act === 'copy-result' && out) {
    navigator.clipboard.writeText(out.textContent).then(function () {
      var m = document.getElementById('copy-msg');
      if (m) { m.textContent = 'Copied!'; setTimeout(function () { m.textContent = ''; }, 1500); }
    });
  } else if (b.dataset.act === 'signin') {
    signIn();
  } else if (b.dataset.act === 'refine' && out && inp) {
    inp.value = out.textContent; inp.focus();
  }
});


// Let the prompt box grow with what you type (up to its CSS max-height).
(function () {
  var t = document.getElementById('prompt-input');
  if (!t) return;
  function grow() { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 420) + 'px'; }
  t.addEventListener('input', grow);
  window.addEventListener('load', grow);
})();
