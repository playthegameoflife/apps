// Prompt Generator web app logic
const BACKEND_URL = 'https://api-clyep56cdq-uc.a.run.app';
const STRIPE_PRICE_ID = 'price_1SuFV7GdisCqoeFIRmlo7yb2';
const GOOGLE_CLIENT_ID = '1097186279139-00aqbna3di7fch3m5mbvov2824lri3bq.apps.googleusercontent.com';
const FREE_LIMIT = 5;

let state = {
  userId: null,
  user: null,
  isPro: false,
  mode: 'TEXT_ENHANCEMENT',
  style: 'default',
  weeklyUsage: { weekStart: null, enhancements: 0 },
  history: [],
};

// ---- storage helpers ----
function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function lsSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const ws = new Date(now.setDate(diff));
  return ws.toDateString();
}

function loadState() {
  state.userId = lsGet('phg_userId', null);
  state.user = lsGet('phg_user', null);
  state.history = lsGet('phg_history', []);
  const wu = lsGet('phg_weeklyUsage', null);
  const cur = getWeekStart();
  if (wu && wu.weekStart === cur) state.weeklyUsage = wu;
  else state.weeklyUsage = { weekStart: cur, enhancements: 0 };
  if (!state.userId) {
    state.userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    lsSet('phg_userId', state.userId);
  }
}

function saveUsage() { lsSet('phg_weeklyUsage', state.weeklyUsage); }
function saveHistory() { lsSet('phg_history', state.history.slice(0, 50)); }

// ---- UI helpers ----
const $ = (id) => document.getElementById(id);
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setText(id, t) { const e = $(id); if (e) e.textContent = t; }

function renderUsage() {
  const cur = state.weeklyUsage.enhancements;
  const limit = state.isPro ? '∞' : FREE_LIMIT;
  setText('usage-label', `Enhancements this week: ${cur} / ${limit}`);
  const pct = state.isPro ? 100 : Math.min(100, (cur / FREE_LIMIT) * 100);
  $('usage-fill').style.width = pct + '%';
}

function renderPlan() {
  const pill = $('plan-pill');
  if (state.isPro) {
    pill.textContent = 'Pro';
    pill.className = 'status-pill pro';
    hide($('upgrade-btn'));
    show($('portal-btn'));
  } else {
    pill.textContent = 'Free';
    pill.className = 'status-pill free';
    show($('upgrade-btn'));
    hide($('portal-btn'));
  }
  if (state.user) {
    setText('user-label', `${state.user.displayName || state.user.email || 'Signed in'} (${state.user.email || ''})`);
    show($('signout-btn'));
    hide($('signin-btn'));
  } else {
    setText('user-label', 'Not signed in — using guest mode');
    show($('signin-btn'));
    hide($('signout-btn'));
  }
}

function renderHistory() {
  const list = $('history-list');
  if (!state.history.length) { list.innerHTML = '<span class="muted">No history yet.</span>'; return; }
  const limit = state.isPro ? 50 : 1;
  const items = state.history.slice(0, limit);
  list.innerHTML = items.map(h => `
    <div class="history-item">
      <div class="h-mode">${h.mode.replace('_ENHANCEMENT','')} · ${h.style}</div>
      <div class="h-text">${escapeHtml(h.result)}</div>
    </div>
  `).join('');
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- modes/styles ----
function populateModes() {
  const tabs = $('mode-tabs');
  tabs.innerHTML = MODES.map(m =>
    `<button class="mode-tab ${m.key === state.mode ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>`
  ).join('');
  tabs.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      populateModes();
      populateStyles(state.mode);
      const m = MODES.find(x => x.key === state.mode);
      $('prompt-input').placeholder = m ? m.placeholder : '';
    });
  });
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
let tokenClient = null;
function initGoogle() {
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(initGoogle, 500);
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    callback: async (resp) => {
      if (resp.error) {
        $('auth-msg').textContent = 'Sign-in failed: ' + resp.error;
        return;
      }
      try {
        const r = await fetch(BACKEND_URL + '/verify-google-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: resp.access_token }),
        });
        if (!r.ok) throw new Error('verify failed');
        const user = await r.json();
        state.user = user;
        state.userId = user.uid;
        lsSet('phg_user', user);
        lsSet('phg_userId', user.uid);
        $('auth-msg').textContent = 'Signed in.';
        await checkSubscription();
        renderPlan();
        renderUsage();
      } catch (e) {
        $('auth-msg').textContent = 'Sign-in error: ' + e.message;
      }
    },
  });
}

function signIn() {
  if (!tokenClient) { $('auth-msg').textContent = 'Google not ready yet.'; return; }
  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function signOut() {
  state.user = null;
  lsSet('phg_user', null);
  // revert to a fresh anon id
  state.userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  lsSet('phg_userId', state.userId);
  state.isPro = false;
  renderPlan();
  renderUsage();
  $('auth-msg').textContent = 'Signed out.';
}

// ---- subscription ----
async function checkSubscription() {
  try {
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId));
    if (!r.ok) { state.isPro = false; return; }
    const d = await r.json();
    state.isPro = !!d.active;
  } catch {
    state.isPro = false;
  }
}

// ---- usage ----
function canUse() {
  if (state.isPro) return { allowed: true };
  const cur = state.weeklyUsage.enhancements;
  return { allowed: cur < FREE_LIMIT, remaining: Math.max(0, FREE_LIMIT - cur) };
}

function trackUsage() {
  state.weeklyUsage.weekStart = getWeekStart();
  state.weeklyUsage.enhancements++;
  saveUsage();
}

// ---- generate ----
async function generate() {
  const prompt = $('prompt-input').value.trim();
  if (!prompt) { $('gen-error').textContent = 'Please enter a prompt.'; show($('gen-error')); return; }
  hide($('gen-error'));
  const c = canUse();
  if (!c.allowed) {
    $('gen-error').textContent = 'Free limit reached. Upgrade to Pro for unlimited.';
    show($('gen-error'));
    return;
  }
  const btn = $('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  setText('gen-status', '');
  const sys = getSystemInstruction(state.mode, state.style);
  try {
    const r = await fetch(BACKEND_URL + '/enhance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction: sys }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || ('HTTP ' + r.status));
    }
    const d = await r.json();
    const result = d.result || '';
    $('output').textContent = result;
    $('output').classList.remove('empty');
    trackUsage();
    // history
    state.history.unshift({ mode: state.mode, style: state.style, prompt, result, timestamp: Date.now() });
    saveHistory();
    renderUsage();
    renderHistory();
    setText('gen-status', 'Done');
  } catch (e) {
    $('gen-error').textContent = 'Error: ' + e.message;
    show($('gen-error'));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Generate';
  }
}

function copyOutput() {
  const text = $('output').textContent;
  if (!text || $('output').classList.contains('empty')) return;
  navigator.clipboard.writeText(text).then(() => {
    setText('copy-msg', 'Copied!');
    setTimeout(() => setText('copy-msg', ''), 1500);
  }).catch(() => { setText('copy-msg', 'Copy failed'); });
}

// ---- stripe ----
async function upgrade() {
  const msg = $('upgrade-msg');
  msg.textContent = 'Opening checkout...';
  try {
    const r = await fetch(BACKEND_URL + '/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        priceId: STRIPE_PRICE_ID,
        email: state.user ? state.user.email : undefined,
        successUrl: 'https://promptgenerator.fyi/success.html',
        cancelUrl: 'https://promptgenerator.fyi/cancel.html',
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || ('HTTP ' + r.status));
    }
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else throw new Error('No checkout URL');
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

async function portal() {
  const msg = $('upgrade-msg');
  msg.textContent = 'Opening billing portal...';
  try {
    // get customerId from subscription status
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId));
    const d = await r.json();
    const r2 = await fetch(BACKEND_URL + '/create-portal-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.userId,
        customerId: d.customerId,
        returnUrl: 'https://promptgenerator.fyi/generate.html',
      }),
    });
    if (!r2.ok) {
      const dd = await r2.json().catch(() => ({}));
      throw new Error(dd.error || ('HTTP ' + r2.status));
    }
    const dd = await r2.json();
    if (dd.url) window.location.href = dd.url;
    else throw new Error('No portal URL');
  } catch (e) {
    msg.textContent = 'Error: ' + e.message;
  }
}

// ---- init ----
document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  populateModes();
  populateStyles(state.mode);
  const m = MODES.find(x => x.key === state.mode);
  if (m) $('prompt-input').placeholder = m.placeholder;

  await checkSubscription();
  renderPlan();
  renderUsage();
  renderHistory();

  $('signin-btn').addEventListener('click', signIn);
  $('signout-btn').addEventListener('click', signOut);
  $('generate-btn').addEventListener('click', generate);
  $('clear-btn').addEventListener('click', () => { $('prompt-input').value = ''; $('output').textContent = 'Your enhanced prompt will appear here.'; $('output').classList.add('empty'); });
  $('copy-btn').addEventListener('click', copyOutput);
  $('upgrade-btn').addEventListener('click', upgrade);
  $('portal-btn').addEventListener('click', portal);

  initGoogle();
});
