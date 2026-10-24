/* ============================================================
   AUTH CONFIG — single source of truth for sign-in.

   WHY THIS FILE EXISTS
   --------------------
   The web app previously hard-coded the Chrome extension's OAuth
   client id (…00aqbna3di7fch3m5mbvov2824lri3bq). That client is
   registered as a "Chrome extension" application type, so Google
   rejects every web origin with `origin_mismatch` — sign-in was
   100% broken on the web app and nobody could ever sign in.

   Two client kinds, two flows
   ---------------------------
   * PUBLIC client ("Web application" in Cloud Console)
     → Authorization Code + PKCE, exchanged client-side.
       No client secret. This is the right kind for a website.

   * CONFIDENTIAL client (Google's own Firebase web client)
     → The token endpoint demands a client_secret, so a client-side
       code exchange is impossible. Only the IMPLICIT flow works
       (Google returns the token in the redirect fragment).

   auth.js probes each candidate, detects which kind it is, and uses
   the matching flow. The first candidate whose origin is registered
   in Cloud Console wins — you never edit this file again afterwards.

   TO FIX SIGN-IN PERMANENTLY
   --------------------------
   Option A (preferred) — create a dedicated Web application client:
     1. Google Cloud Console → project 1097186279139 (or your own)
     2. APIs & Services → Credentials → Create Credentials
        → OAuth client ID → Application type: **Web application**
     3. Add Authorized JavaScript origins:
          https://promptgenerator.fyi
          http://localhost:8082
     4. Copy the client id and add it to the candidates list below.

   Option B — reuse the Firebase web client (8deig) already in this
   project. It is confidential, so auth.js will use the implicit flow
   for it. You still need to add this site's origin:
     1. Same OAuth client → Authorized JavaScript origins:
          https://promptgenerator.fyi
          http://localhost:8082
     2. AND widen the Firebase API key's HTTP referrer restrictions
        to include https://promptgenerator.fyi/* and
        http://localhost:8082/* (otherwise Firebase's own auth
        endpoints 403 for this origin).

   See AUTH_SETUP_RUNBOOK.md for the exact click-path.
   ============================================================ */
window.PHG_AUTH_CONFIG = {
  // Google OAuth client ids, tried in order. See comment above.
  candidates: [
    {
      clientId: '1097186279139-8deig9lgvgj8korv12fbaj81la3qk079.apps.googleusercontent.com',
      label: 'Firebase web client (project 1097186279139)',
      project: '1097186279139',
      // CONFIDENTIAL client — auth.js detects this and uses the
      // implicit flow, because the token endpoint requires a secret.
      kind: 'confidential',
      requires: 'Authorized JavaScript origin = ' + (location.protocol + '//' + location.host)
    },
    {
      clientId: '097186279139-00aqbna3di7fch3m5mbvov2824lri3bq.apps.googleusercontent.com',
      label: 'Legacy web client (deleted from Console — no longer exists)',
      project: '097186279139',
      kind: 'extension',
      requires: 'Client must be recreated in Cloud Console as a Web application'
    }
  ],

  // Implicit-token scopes. Must NOT include `openid` (incompatible with
  // response_type=token). These map exactly to the scopes the backend
  // exchanges via https://www.googleapis.com/oauth2/v2/userinfo.
  scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',

  // Where Google sends the popup after a successful sign-in.
  // Must be same-origin as the site and listed as an authorized
  // JavaScript origin on the OAuth client.
  callbackPath: '/auth-callback.html',

  // Backend that verifies the Google access token and returns the
  // account identity (uid / email / displayName).
  backendUrl: 'https://api-clyep56cdq-uc.a.run.app',

  // How long to wait for the popup to come back before telling the
  // user that the OAuth client is probably not authorized for this
  // origin.
  popupTimeoutMs: 90000,

  // How long to wait for the viability probe to resolve.
  probeTimeoutMs: 12000
};
