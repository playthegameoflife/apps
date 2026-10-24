/* ============================================================
   SHARED AUTH — one working sign-in implementation for every page.

   WHY THIS FILE EXISTS
   --------------------
   The web app hard-coded the Chrome extension's OAuth client
   (…00aqbna3di7fch3m5mbvov2824lri3bq). That client is registered as
   a "Chrome extension" application type, so Google rejects every web
   origin with `origin_mismatch`. The "Sign in with Google" button
   errored on every click, on every page. Nobody could ever sign in.

   Two OAuth client kinds, two flows
   ---------------------------------
   * PUBLIC client ("Web application" in Cloud Console)
       → Authorization Code + PKCE. The code is exchanged client-side
         with the PKCE verifier. No client secret needed.

   * CONFIDENTIAL client (Google's own Firebase web client)
       → The token endpoint demands a client_secret, so a client-side
         code exchange is impossible. The IMPLICIT flow is the only
         option: Google returns the access token directly in the
         redirect fragment.

   This module detects which kind a client is by asking Google's token
   endpoint, then uses the matching flow. The callback page
   (auth-callback.html) handles both.

   The candidate list lives in auth-config.js. Once ONE client is
   authorized for this origin in Cloud Console, sign-in works — you
   never have to edit this file again.

   IMPORTANT: the popup is opened SYNCHRONOUSLY inside the click
   handler. Browsers only allow window.open() during a user gesture,
   and this module has to await the token endpoint before it knows
   which URL to open. So we open a blank window immediately and
   navigate it afterwards.

   Identity note
   -------------
   The backend resolves identity from Google's global `userinfo.id` —
   the same value the Chrome extension gets. So signing in on the web
   and signing in in the extension give you the SAME account, and Pro
   subscriptions stay linked across both.

   Storage
   -------
   phg_user    -> { uid, email, displayName }
   phg_userId  -> uid (kept for compatibility with the subscription
                  lookup, which is keyed by uid)
   ============================================================ */
(function () {
  const CFG = window.PHG_AUTH_CONFIG || {};
  const CANDIDATES = CFG.candidates || [];
  const SCOPE = CFG.scope ||
    'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  const BACKEND = CFG.backendUrl || '';
  const CALLBACK_PATH = CFG.callbackPath || '/auth-callback.html';
  const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
  const TIMEOUT_MS = CFG.popupTimeoutMs || 120000;

  const STORAGE_KEY = 'phg_user';
  const STORAGE_ID = 'phg_userId';
  const PKCE_STORE = 'phg_auth_pkce';
  const PENDING_TOKEN = 'phg_pending_token';

  const listeners = new Set();
  let pending = null;          // in-flight signIn promise
  let resolved = null;         // { clientId, flow } once we know one works
  const kindCache = new Map(); // clientId -> 'code' | 'implicit'

  /* ---------------- storage helpers ---------------- */

  function readLS(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function writeLS(key, val) {
    try {
      if (val === null || val === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { /* private mode / storage disabled */ }
  }
  function getUser() { return readLS(STORAGE_KEY); }
  function getUserId() { return readLS(STORAGE_ID); }

  function notify() {
    const u = getUser();
    listeners.forEach((cb) => { try { cb(u); } catch (e) { /* listener threw */ } });
  }

  /* ---------------- status messaging ---------------- */

  function statusEl() {
    return document.getElementById('auth-msg') ||
           document.getElementById('sb-auth-msg') ||
           document.getElementById('upgrade-msg');
  }
  function setStatus(text, isError) {
    const el = statusEl();
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('auth-error', !!isError);
  }

  /* ---------------- PKCE helpers ---------------- */

  function randomString(len) {
    const bytes = new Uint8Array(len);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
  }

  function base64UrlEncode(bytes) {
    let str = '';
    bytes.forEach((b) => { str += String.fromCharCode(b); });
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function makeCodeChallenge(verifier) {
    const enc = new TextEncoder().encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', enc);
    return base64UrlEncode(new Uint8Array(digest));
  }

  /* ---------------- client kind detection ---------------- */

  // A confidential client answers "client_secret is missing" when we post
  // a token request without a secret. A public client instead rejects the
  // bogus code with "invalid_grant". Either way we learn which flow to use.
  async function detectFlow(clientId) {
    if (kindCache.has(clientId)) return kindCache.get(clientId);
    let flow = 'code';
    let exists = true;
    try {
      const res = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: 'probe', client_id: clientId, code_verifier: 'probe',
          grant_type: 'authorization_code', redirect_uri: 'http://localhost/probe'
        }).toString()
      });
      const j = await res.json().catch(() => ({}));
      const desc = String(j.error_description || j.error || '');
      if (/client_secret is missing/i.test(desc)) flow = 'implicit';
      if (/not found/i.test(desc)) exists = false;
    } catch (e) {
      // Network trouble: assume the public/PKCE flow, which is the
      // standard case, and let the real attempt surface any problem.
      flow = 'code';
    }
    kindCache.set(clientId, flow);
    return exists ? flow : null;
  }

  /* ---------------- backend exchange ---------------- */

  async function verifyTokenAtBackend(accessToken) {
    const res = await fetch(BACKEND + '/verify-google-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch (e) {}
      throw new Error(detail || ('Verification failed (HTTP ' + res.status + ')'));
    }
    return res.json();
  }

  /* ---------------- popup helpers ---------------- */

  function popupFeatures() {
    const w = Math.min(520, (window.screen.availWidth || 1200) - 40);
    const h = Math.min(700, (window.screen.availHeight || 800) - 80);
    const left = Math.max(0, Math.round(((window.screen.availWidth || 1200) - w) / 2));
    const top = Math.max(0, Math.round(((window.screen.availHeight || 800) - h) / 2));
    return `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no`;
  }

  // MUST be called synchronously from the click handler.
  function openPopup() {
    return window.open('about:blank', 'phg_google_signin', popupFeatures());
  }

  function listenForCallback() {
    return new Promise((resolve) => {
      const onMsg = (ev) => {
        if (ev.origin !== location.origin) return;
        if (!ev.data || ev.data.phgAuth !== 'result') return;
        window.removeEventListener('message', onMsg);
        resolve(ev.data);   // { access_token, code, error, state }
      };
      window.addEventListener('message', onMsg);
    });
  }

  async function exchangeCodeForToken(code, verifier, clientId) {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: location.origin + CALLBACK_PATH
    });
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error_description || json.error || ('HTTP ' + res.status));
    }
    return json.access_token;
  }

  function buildAuthUrl(candidate, flow, state, challenge) {
    const params = {
      client_id: candidate.clientId,
      response_type: flow === 'code' ? 'code' : 'token',
      scope: SCOPE,
      redirect_uri: location.origin + CALLBACK_PATH,
      state,
      prompt: 'select_account'
    };
    if (flow === 'code') {
      params.code_challenge = challenge;
      params.code_challenge_method = 'S256';
    }
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams(params).toString();
  }

  /* ---------------- sign-in attempt ---------------- */

  async function attemptSignIn(candidate, flow, popup) {
    const state = randomString(32);
    let verifier = null;
    let challenge = null;

    if (flow === 'code') {
      verifier = randomString(64);
      challenge = await makeCodeChallenge(verifier);
    }
    writeLS(PKCE_STORE, { verifier, state, clientId: candidate.clientId });

    const url = buildAuthUrl(candidate, flow, state, challenge);

    const resultPromise = listenForCallback();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ error: 'timeout' }), TIMEOUT_MS);
    });

    try {
      popup.location.replace(url);
    } catch (e) {
      writeLS(PKCE_STORE, null);
      throw new Error('popup_blocked');
    }

    const result = await Promise.race([resultPromise, timeoutPromise]);
    try { if (!popup.closed) popup.close(); } catch (e) {}

    if (!result || result.error) {
      writeLS(PKCE_STORE, null);
      throw new Error((result && result.error) || 'timeout');
    }

    let accessToken = result.access_token;
    if (!accessToken && result.code) {
      const store = readLS(PKCE_STORE) || {};
      if (!store.verifier || (store.state && result.state && store.state !== result.state)) {
        writeLS(PKCE_STORE, null);
        throw new Error('state_mismatch');
      }
      accessToken = await exchangeCodeForToken(result.code, store.verifier, store.clientId || candidate.clientId);
    }
    writeLS(PKCE_STORE, null);

    if (!accessToken) throw new Error('no_token');
    return accessToken;
  }

  // Google's error page lands in the popup and never redirects back, so
  // the popup just sits there until the timeout. We detect that by
  // watching the popup's location: Google error pages are on
  // accounts.google.com with an authError parameter.
  function watchPopupForError(popup, ms) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; clearInterval(poll); resolve(v); } };
      const poll = setInterval(() => {
        let href = '';
        try { href = popup.location.href; } catch (e) { return; }  // cross-origin
        if (!href) return;
        if (href.indexOf('accounts.google.com/signin/oauth/error') !== -1) {
          const m = href.match(/authError=([^&]+)/);
          let reason = 'not_authorized';
          if (m) {
            try {
              const raw = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
              const dec = atob(raw + '==='.slice((raw.length + 3) % 4));
              const em = dec.match(/redirect_uri_mismatch|origin_mismatch|invalid_client|invalid_request|access_denied/);
              if (em) reason = em[0];
            } catch (x) {}
          }
          finish(reason);
        }
      }, 500);
      setTimeout(() => finish(null), ms);
    });
  }

  /* ---------------- public API ---------------- */

  async function signIn() {
    if (pending) return pending;

    // Open the popup NOW, synchronously, so the browser treats it as a
    // user-initiated window. Everything below is async.
    const popup = openPopup();
    if (!popup) {
      setStatus('The sign-in popup was blocked. Allow popups for this site and try again.', true);
      const err = new Error('popup_blocked');
      err.fatal = true;
      err.code = 'popup_blocked';
      return Promise.reject(err);
    }

    let lastError = 'unknown';

    const promise = (async () => {
      setStatus('Opening Google sign-in…');

      // Order: a known-good candidate first, then the rest.
      const order = resolved
        ? CANDIDATES.filter((c) => c.clientId === resolved.clientId)
                     .concat(CANDIDATES.filter((c) => c.clientId !== resolved.clientId))
        : CANDIDATES.slice();

      for (const candidate of order) {
        let flow = (resolved && resolved.clientId === candidate.clientId) ? resolved.flow : null;
        if (!flow) {
          try {
            flow = await detectFlow(candidate.clientId);
          } catch (e) {
            flow = null;
          }
          if (!flow) { lastError = 'client_not_found'; continue; }
        }

        try {
          const accessToken = await attemptSignIn(candidate, flow, popup);
          resolved = { clientId: candidate.clientId, flow };
          const user = await verifyTokenAtBackend(accessToken);
          writeLS(STORAGE_KEY, user);
          writeLS(STORAGE_ID, user.uid);
          // Keep the token so the backend can identify the caller and
          // enforce quota against the right account.
          storeToken(accessToken);
          setStatus('Signed in as ' + (user.displayName || user.email || 'your account') + '.');
          notify();
          return user;
        } catch (e) {
          lastError = e.message || String(e);
          if (lastError === 'popup_blocked') {
            const err = new Error(lastError);
            err.fatal = true;
            err.code = 'popup_blocked';
            throw err;
          }
          try { writeLS(PKCE_STORE, null); } catch (x) {}

          // Google showed an error page instead of redirecting back.
          // Read the reason so we can report something useful, and so we
          // know whether trying another candidate could ever help.
          const reason = await watchPopupForError(popup, 4000);
          if (reason) {
            lastError = reason;
            // A client/origin mismatch is specific to this client, so no
            // other candidate can fix it. Move on to the next one.
            if (reason === 'redirect_uri_mismatch' ||
                reason === 'origin_mismatch' ||
                reason === 'invalid_client') {
              continue;
            }
          }
          // Otherwise the popup may still be a live Google consent
          // screen and the timeout was the only failure. Report it and
          // stop — retrying other clients would just open more popups.
          if (lastError === 'timeout') break;
        }
      }

      try { if (!popup.closed) popup.close(); } catch (e) {}

      setStatus(
        'Sign-in is not configured for this site yet. ' +
        location.origin + ' needs to be added as an authorized origin for the Google OAuth client.',
        true
      );
      const err = new Error(lastError);
      err.code = 'no_authorized_client';
      throw err;
    })();

    pending = promise;
    promise.catch(() => {}).finally(() => { pending = null; });
    return promise;
  }

  function signOut() {
    writeLS(STORAGE_KEY, null);
    writeLS(STORAGE_ID, null);
    clearToken();
    setStatus('Signed out.');
    notify();
  }

  function onChange(cb) {
    if (typeof cb === 'function') listeners.add(cb);
    return () => listeners.delete(cb);
  }

  // Adopt a token the callback page stashed (used when the popup could not
  // post back, e.g. popup blockers that allow the redirect but not postMessage).
  function adoptPendingToken() {
    const t = readLS(PENDING_TOKEN);
    if (!t || !t.access_token) return null;
    if (Date.now() - (t.at || 0) > 120000) { writeLS(PENDING_TOKEN, null); return null; }
    writeLS(PENDING_TOKEN, null);
    return t.access_token;
  }

  // --- Access token storage -------------------------------------------------
  // The backend now enforces quotas server-side, which means it needs to
  // know WHO is calling. The Google access token is what proves that, so we
  // keep it around and send it with each request.
  //
  // Security notes:
  //  - It is stored in localStorage, like the rest of this app's session
  //    state. It is a bearer token scoped to the user's own Google profile,
  //    and it is the same token the Chrome extension already holds.
  //  - It is never written into a URL. URLs leak via history, referrers and
  //    server logs.
  //  - It is cleared on sign-out.
  const TOKEN_STORE = 'phg_access_token';

  function storeToken(accessToken) {
    if (!accessToken) { writeLS(TOKEN_STORE, null); return; }
    writeLS(TOKEN_STORE, { access_token: accessToken, at: Date.now() });
  }

  /** The current Google access token, or null if not signed in / expired. */
  function getAccessToken() {
    const t = readLS(TOKEN_STORE);
    if (!t || !t.access_token) return null;
    // Google tokens issued by the implicit flow are short-lived. If ours is
    // older than ~50 minutes, treat it as stale rather than sending it and
    // having the backend reject the request.
    if (t.at && Date.now() - t.at > 50 * 60 * 1000) return null;
    return t.access_token;
  }

  function clearToken() { writeLS(TOKEN_STORE, null); }

  window.PHGAuth = {
    signIn,
    signOut,
    getUser,
    getUserId,
    onChange,
    notify,
    adoptPendingToken,
    detectFlow,
    getAccessToken,
    clearToken,
    // Exposed for the QA suite and diagnostics tooling.
    _internal: { CANDIDATES, get resolved() { return resolved; } }
  };

  // A restored session should repaint pages that subscribe later.
  if (getUser()) setTimeout(notify, 0);
})();
