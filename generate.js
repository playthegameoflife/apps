// Prompt Generator web app logic (enhanced)
const BACKEND_URL = 'https://api-clyep56cdq-uc.a.run.app';
const STRIPE_MONTHLY_PRICE_ID = 'price_1SuFV7GdisCqoeFIRmlo7yb2';
const STRIPE_ANNUAL_PRICE_ID = 'price_REPLACE_WITH_ANNUAL_PRICE_ID'; // Create in Stripe Dashboard → Products → Add price → $199/yr
const STRIPE_PRICE_ID = STRIPE_MONTHLY_PRICE_ID;
const GOOGLE_CLIENT_ID = '1097186279139-00aqbna3di7fch3m5mbvov2824lri3bq.apps.googleusercontent.com';
const FREE_LIMIT = 5;

const TEMPLATES = [
  // Text
  { mode:'TEXT_ENHANCEMENT', label:'Cold outreach email', prompt:'write a cold outreach email to a potential client about our new product' },
  { mode:'TEXT_ENHANCEMENT', label:'Blog post outline', prompt:'create an outline for a blog post about AI productivity tools' },
  { mode:'TEXT_ENHANCEMENT', label:'Meeting summary', prompt:'summarize a meeting transcript into action items and decisions' },
  { mode:'TEXT_ENHANCEMENT', label:'Product description', prompt:'write a compelling product description for a smart water bottle' },
  // Code
  { mode:'CODE_ENHANCEMENT', label:'Sort array', prompt:'a function that sorts an array of objects by a date field' },
  { mode:'CODE_ENHANCEMENT', label:'REST API endpoint', prompt:'create a REST API endpoint for user registration with validation' },
  { mode:'CODE_ENHANCEMENT', label:'React component', prompt:'a reusable React button component with variants and loading state' },
  { mode:'CODE_ENHANCEMENT', label:'SQL query', prompt:'write a SQL query to find top 10 customers by revenue this month' },
  // Image
  { mode:'IMAGE_ENHANCEMENT', label:'Sci-fi city', prompt:'a futuristic city at sunset with flying cars and neon lights' },
  { mode:'IMAGE_ENHANCEMENT', label:'Portrait', prompt:'professional headshot of a confident entrepreneur in a modern office' },
  { mode:'IMAGE_ENHANCEMENT', label:'Product shot', prompt:'minimalist product photo of a wireless earbud on a marble surface' },
  { mode:'IMAGE_ENHANCEMENT', label:'Fantasy landscape', prompt:'a magical forest with glowing mushrooms and a misty river' },
  // Video
  { mode:'VIDEO_ENHANCEMENT', label:'Drone shot', prompt:'cinematic drone shot of a futuristic city at golden hour' },
  { mode:'VIDEO_ENHANCEMENT', label:'Product ad', prompt:'a 15-second ad for a new smartphone showing its camera features' },
  { mode:'VIDEO_ENHANCEMENT', label:'Nature doc', prompt:'a sweeping nature documentary shot of a whale breaching' },
  { mode:'VIDEO_ENHANCEMENT', label:'Anime action', prompt:'an anime-style action scene with a hero charging forward' },
];

let state = {
  userId: null,
  user: null,
  isPro: false,
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
function saveUsage() { lsSet('phg_weeklyUsage', state.weeklyUsage); }
function saveHistory() { lsSet('phg_history', state.history.slice(0, 100)); }
function saveMemory() { lsSet('phg_memory', state.memory); }

// ---- ui helpers ----
const $ = (id) => document.getElementById(id);
function show(el) { if (el) el.classList.remove('hidden'); }
function hide(el) { if (el) el.classList.add('hidden'); }
function setText(id, t) { const e = $(id); if (e) e.textContent = t; }
function escapeHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderUsage() {
  const cur = state.weeklyUsage.enhancements;
  const limit = state.isPro ? '∞' : FREE_LIMIT;
  setText('usage-label', `Enhancements this week: ${cur} / ${limit}`);
  const pct = state.isPro ? 100 : Math.min(100, (cur / FREE_LIMIT) * 100);
  const f = $('usage-fill'); if (f) f.style.width = pct + '%';
}
function renderPlan() {
  const pill = $('plan-pill');
  const badge = $('plan-badge');
  if (state.isPro) {
    if (pill) { pill.textContent = 'Pro'; pill.className = 'status-pill pro'; }
    if (badge) { badge.textContent = 'Pro'; badge.style.background = ''; badge.style.color = ''; }
    hide($('upgrade-btn')); show($('portal-btn'));
  } else {
    if (pill) { pill.textContent = 'Free'; pill.className = 'status-pill free'; }
    if (badge) { badge.textContent = 'Free'; badge.style.background = ''; badge.style.color = ''; }
    show($('upgrade-btn')); hide($('portal-btn'));
  }
  if (state.user) {
    setText('user-label', `${state.user.displayName || state.user.email || 'Signed in'} (${state.user.email || ''})`);
    show($('signout-btn')); hide($('signin-btn'));
  } else {
    setText('user-label', 'Not signed in — using guest mode');
    show($('signin-btn')); hide($('signout-btn'));
  }
}
function renderMemory() {
  const inp = $('memory-input'); if (inp) inp.value = state.memory.notes;
  const t = $('memory-toggle'); if (t) t.checked = state.memory.use;
}

function scorePrompt(text) {
  if (!text) return 0;
  let s = 0;
  const len = text.length;
  s += Math.min(30, Math.round(len / 60));
  const low = text.toLowerCase();
  if (/\b(you are|act as|role|persona|expert)\b/.test(low)) s += 15;
  if (/\b(table|bullet|json|format|structure|list|markdown)\b/.test(low)) s += 15;
  if (/\b(constraints?|limit|must|should|exactly|at least|no more)\b/.test(low)) s += 10;
  if (/\b(tone|style|professional|casual|concise|detailed)\b/.test(low)) s += 10;
  if (/\n/.test(text)) s += 10;
  if (/\d/.test(text)) s += 5;
  return Math.min(100, s);
}
function scoreLabel(s) {
  if (s >= 80) return { label: 'Excellent', cls: 'score-excellent' };
  if (s >= 60) return { label: 'Good', cls: 'score-good' };
  if (s >= 40) return { label: 'Fair', cls: 'score-fair' };
  return { label: 'Poor', cls: 'score-poor' };
}

function renderHistory() {
  const list = $('history-list');
  const q = ($('history-search')?.value || '').toLowerCase();
  let items = state.history;
  if (q) items = items.filter(h => (h.prompt + ' ' + h.result).toLowerCase().includes(q));
  if (!items.length) { list.innerHTML = '<span class="muted">No history yet.</span>'; return; }
  const limit = state.isPro ? 100 : 1;
  items = items.slice(0, limit);
  list.innerHTML = items.map((h, i) => `
    <div class="history-item" data-idx="${i}">
      <div class="h-mode">${h.mode.replace('_ENHANCEMENT','')} · ${h.style}${h.target ? ' · ' + h.target : ''}</div>
      <div class="h-text">${escapeHtml(h.result)}</div>
    </div>
  `).join('');
  list.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.idx);
      const h = items[idx];
      if (h) { $('prompt-input').value = h.prompt; state.mode = h.mode; state.style = h.style; populateModes(); populateStyles(state.mode); $('style-select').value = state.style; state.style = $('style-select').value; }
    });
  });
}

// ---- modes/styles ----
function populateModes() {
  const tabs = $('mode-tabs');
  tabs.innerHTML = MODES.map(m => `<button class="mode-tab ${m.key === state.mode ? 'active' : ''}" data-mode="${m.key}">${m.label}</button>`).join('');
  tabs.querySelectorAll('.mode-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      state.mode = btn.dataset.mode;
      populateModes();
      populateStyles(state.mode);
      const m = MODES.find(x => x.key === state.mode);
      if (m) $('prompt-input').placeholder = m.placeholder;
      renderTemplates();
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

// ---- templates ----
function renderTemplates() {
  const wrap = $('templates-wrap');
  const ts = TEMPLATES.filter(t => t.mode === state.mode);
  wrap.innerHTML = ts.map(t => `<span class="template-chip" data-prompt="${escapeHtml(t.prompt)}">${escapeHtml(t.label)}</span>`).join('');
  wrap.querySelectorAll('.template-chip').forEach(c => {
    c.addEventListener('click', () => { $('prompt-input').value = c.dataset.prompt; $('prompt-input').focus(); });
  });
}

// ---- auth ----
let tokenClient = null;
function initGoogle() {
  if (typeof google === 'undefined' || !google.accounts) { setTimeout(initGoogle, 500); return; }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
    callback: async (resp) => {
      if (resp.error) { $('auth-msg').textContent = 'Sign-in failed: ' + resp.error; return; }
      try {
        const r = await fetch(BACKEND_URL + '/verify-google-token', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ accessToken: resp.access_token }) });
        if (!r.ok) throw new Error('verify failed');
        const user = await r.json();
        state.user = user; state.userId = user.uid;
        lsSet('phg_user', user); lsSet('phg_userId', user.uid);
        $('auth-msg').textContent = 'Signed in.';
        await checkSubscription(); renderPlan(); renderUsage();
        if (state.pendingUpgrade) { state.pendingUpgrade = false; upgrade(); }
      } catch (e) { $('auth-msg').textContent = 'Sign-in error: ' + e.message; }
    },
  });
}
function signIn() { if (!tokenClient) { $('auth-msg').textContent = 'Google not ready yet.'; return; } tokenClient.requestAccessToken({ prompt: 'consent' }); }
function signOut() {
  state.user = null; lsSet('phg_user', null);
  state.userId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  lsSet('phg_userId', state.userId); state.isPro = false;
  renderPlan(); renderUsage(); $('auth-msg').textContent = 'Signed out.';
}

// ---- subscription ----
async function checkSubscription() {
  try {
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId));
    if (!r.ok) { state.isPro = false; return; }
    const d = await r.json(); state.isPro = !!d.active;
  } catch { state.isPro = false; }
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
    const r = await fetch(BACKEND_URL + '/enhance-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemInstruction }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || ('HTTP ' + r.status));
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
  const c = canUse();
  if (!c.allowed && !state.isPro) {
    $('gen-error').textContent = 'Free limit reached (5/week). Upgrade to Pro for unlimited.';
    show($('gen-error')); return;
  }
  if (generating) return;
  generating = true;
  const btn = $('generate-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';
  setText('gen-status', 'Streaming…');
  const sys = buildSystemInstruction(state.mode, variantStyle || state.style, $('target-select').value, state.memory.notes);
  state.refineMode = false;

  // Chat UX: show user message + AI bubble
  addUserMessage(prompt);
  const out = $('output');
  out.textContent = '';
  out.classList.remove('empty');
  out.classList.add('has-content');
  showAIMessage();
  const meta = document.getElementById('output-meta');
  if (meta) meta.innerHTML = '';
  const actions = document.getElementById('output-actions');
  if (actions) actions.innerHTML = '';

  const doOne = (style, outputEl) => new Promise((resolve) => {
    let started = false;
    streamEnhance(prompt, buildSystemInstruction(state.mode, style, $('target-select').value, state.memory.notes),
      (full) => {
        if (!started) { started = true; outputEl.classList.remove('empty'); }
        outputEl.textContent = full;
        const cc = $('char-count'); if (cc && outputEl === $('output')) cc.textContent = `(${full.length} chars)`;
      },
      (full) => {
        const s = scorePrompt(full);
        const sl = scoreLabel(s);
        if (outputEl === $('output')) {
          const meta = document.getElementById('output-meta');
          if (meta) meta.innerHTML = '<span id="score-badge" class="score-badge ' + sl.cls + '">' + sl.label + ' · ' + s + '/100</span>';
          const actions = document.getElementById('output-actions');
          if (actions) actions.innerHTML = '<button class="btn btn-sm" onclick="navigator.clipboard.writeText(document.getElementById(\'output\').textContent).then(()=>{const m=document.getElementById(\'copy-msg\');m.textContent=\'Copied!\';setTimeout(()=>m.textContent=\'\',1500)})">Copy result</button> <button class="btn btn-sm btn-ghost" onclick="document.getElementById(\'prompt-input\').value=document.getElementById(\'output\').textContent;document.getElementById(\'prompt-input\').focus()">Refine</button>';
          state.lastOutput = full; state.lastPrompt = prompt;
          trackUsage(); saveHistoryEntry(prompt, full, style);
          renderUsage(); renderHistory();
          setText('gen-status', 'Done');
        }
        resolve(full);
      },
      (e) => {
        $('gen-error').textContent = 'Error: ' + e.message; show($('gen-error'));
        setText('gen-status', 'Failed');
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
  btn.disabled = false; btn.innerHTML = '✨ Generate';
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
  navigator.clipboard.writeText(text).then(() => { setText('copy-msg', 'Copied!'); setTimeout(() => setText('copy-msg',''), 1500); }).catch(() => setText('copy-msg','Copy failed'));
}
function shareLink() {
  const prompt = encodeURIComponent($('prompt-input').value.trim());
  const url = location.origin + '/?p=' + prompt;
  navigator.clipboard.writeText(url).then(() => { setText('copy-msg', 'Link copied!'); setTimeout(() => setText('copy-msg',''), 1500); }).catch(() => setText('copy-msg','Copy failed'));
}

// ---- stripe ----
async function upgrade() {
  const msg = $('upgrade-msg');
  if (!state.user) {
    state.pendingUpgrade = true;
    msg.textContent = 'Please sign in with Google first to link your Pro subscription across devices…';
    signIn();
    return;
  }
  // Determine price ID based on annual toggle (pricing page) or default to monthly
  const annualToggle = document.getElementById('annual-toggle');
  const useAnnual = annualToggle && annualToggle.checked;
  const priceId = useAnnual ? STRIPE_ANNUAL_PRICE_ID : STRIPE_MONTHLY_PRICE_ID;
  if (priceId.includes('REPLACE')) {
    msg.textContent = 'Annual pricing is being set up. Please use monthly for now.';
    if (useAnnual) return;
  }
  msg.textContent = 'Opening checkout...';
  try {
    const r = await fetch(BACKEND_URL + '/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: state.userId, priceId: priceId, email: state.user ? state.user.email : undefined, successUrl: location.origin + '/success.html', cancelUrl: location.origin + '/cancel.html' }) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); throw new Error(d.error || ('HTTP ' + r.status)); }
    const d = await r.json();
    if (d.url) window.location.href = d.url; else throw new Error('No checkout URL');
  } catch (e) { msg.textContent = 'Error: ' + e.message; }
}
async function portal() {
  const msg = $('upgrade-msg'); msg.textContent = 'Opening billing portal...';
  try {
    const r = await fetch(BACKEND_URL + '/subscription-status/' + encodeURIComponent(state.userId));
    const d = await r.json();
    const r2 = await fetch(BACKEND_URL + '/create-portal-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: state.userId, customerId: d.customerId, returnUrl: location.origin + '/' }) });
    if (!r2.ok) { const dd = await r2.json().catch(()=>({})); throw new Error(dd.error || ('HTTP ' + r2.status)); }
    const dd = await r2.json();
    if (dd.url) window.location.href = dd.url; else throw new Error('No portal URL');
  } catch (e) { msg.textContent = 'Error: ' + e.message; }
}

// ---- init ----
document.addEventListener('DOMContentLoaded', async () => {
  loadState();
  const isGeneratorPage = !!document.getElementById('mode-tabs');

  // load prompt from share link (only on generator page)
  if (isGeneratorPage) {
    const params = new URLSearchParams(location.search);
    if (params.get('p')) $('prompt-input').value = decodeURIComponent(params.get('p'));
  }

  if (isGeneratorPage) {
    populateModes();
    populateStyles(state.mode);
    const m = MODES.find(x => x.key === state.mode);
    if (m) $('prompt-input').placeholder = m.placeholder;
    renderTemplates();
    renderMemory();

    const sb=$('signin-btn'); if(sb) sb.addEventListener('click', signIn);
    const so=$('signout-btn'); if(so) so.addEventListener('click', signOut);
    const gb=$('generate-btn'); if(gb) gb.addEventListener('click', () => generate());
    const rb=$('refine-btn'); if(rb) rb.addEventListener('click', refine);
    const cb2=$('clear-btn'); if(cb2) cb2.addEventListener('click', () => { $('prompt-input').value = ''; $('output').textContent = 'Your enhanced prompt will appear here.'; $('output').classList.add('empty'); $('output').classList.remove('has-content'); const aiMsg = document.getElementById('ai-msg'); if (aiMsg) aiMsg.style.display = 'none'; const conv = document.getElementById('conversation'); if (conv) { conv.innerHTML = ''; conv.style.display = 'none'; } const empty = document.getElementById('empty-state'); if (empty) empty.style.display = 'flex'; $('char-count').textContent = ''; setText('gen-status', ''); });
    const cb=$('copy-btn'); if(cb) cb.addEventListener('click', copyOutput);
    const shb=$('share-btn'); if(shb) shb.addEventListener('click', shareLink);
    $('memory-toggle').addEventListener('change', (e) => { state.memory.use = e.target.checked; saveMemory(); });
    const smb=$('save-memory-btn'); if(smb) smb.addEventListener('click', () => { state.memory.notes = $('memory-input').value; saveMemory(); setText('memory-msg', 'Saved.'); setTimeout(() => setText('memory-msg',''), 1500); });
    const hs=$('history-search'); if(hs) hs.addEventListener('input', renderHistory);
  }

  // Upgrade button exists on pricing page too
  const upgradeBtn = $('upgrade-btn');
  if (upgradeBtn) upgradeBtn.addEventListener('click', upgrade);
  const portalBtn = $('portal-btn');
  if (portalBtn) portalBtn.addEventListener('click', portal);

  await checkSubscription();
  renderPlan(); renderUsage();
  if (isGeneratorPage) renderHistory();

  initGoogle();
});
