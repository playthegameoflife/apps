# Google Sign-In — Cloud Console Runbook

**Status:** the code is complete, tested, and deployed-ready. Sign-in is
blocked by **one** thing that can only be done in Google Cloud Console:
registering this website's origin with a Google OAuth client.

Follow the steps below and sign-in works. No code changes are required.

---

## Why sign-in was broken

The web app hard-coded the Chrome extension's OAuth client id
(`1097186279139-00aqbna3di7fch3m5mbvov2824lri3bq`). Google rejected every
web origin with `origin_mismatch`, because that client is registered as a
**Chrome extension** application type. The "Sign in with Google" button
failed on every page, on every click.

There was a second, independent problem: the Firebase API key's HTTP
referrer restrictions only allow the Chrome extension, so Firebase's own
web auth endpoints also return 403 for this site.

---

## What was fixed in code (already done, already pushed)

| File | Purpose |
|---|---|
| `auth-config.js` | OAuth client candidates + scopes + backend URL |
| `auth.js` | Shared sign-in module (code+PKCE **and** implicit flows) |
| `auth-callback.html` | OAuth redirect target; handles both flows |
| `generate.js` | Old broken `initTokenClient` removed; uses `PHGAuth` |
| `shell.js` | Sidebar sign-in now calls `PHGAuth` directly |
| `library.html` | Sidebar sign-in was a **dead no-op** — now works |
| `pricing.html` | Had **no sign-in button at all** — now added |

`auth.js` probes each OAuth client, detects whether it is public or
confidential, and picks the matching flow automatically. **You only need
ONE client to be authorized for this origin** — the module finds it.

---

## Step 1 — Pick your approach

### Option A (recommended): create a dedicated Web application client

A public client. `auth.js` uses Authorization Code + PKCE, which is the
modern, correct flow. No client secret is ever exposed.

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Select the project **Prompt Helper** (project number `1097186279139`).
   If you would rather not touch that project, create a new project for
   this site — but then also set up the Firebase API key (Step 3).
3. **Create credentials → OAuth client ID**
4. **Application type: Web application**
5. Under **Authorized JavaScript origins**, add:

   ```
   https://promptgenerator.fyi
   http://localhost:8082
   ```

6. Under **Authorized redirect URIs**, add:

   ```
   https://promptgenerator.fyi/auth-callback.html
   http://localhost:8082/auth-callback.html
   ```

7. Copy the client id. It ends in `.apps.googleusercontent.com`.
8. Add it to the `candidates` array in `auth-config.js` (put it first) and
   commit. **No other code change is needed.**

> Note: the "Authorized redirect URIs" list is technically optional for
> the code+PKCE flow when using a same-origin callback, but adding it is
> harmless and removes any chance of a `redirect_uri_mismatch`.

### Option B: reuse the existing Firebase web client

The Firebase web client `1097186279139-8deig9lgvgj8korv12fbaj81la3qk079`
already exists in the Prompt Helper project. It is a **confidential**
client, so `auth.js` will use the implicit flow for it automatically.

1. Open that OAuth client in Cloud Console.
2. Add to **Authorized JavaScript origins**:

   ```
   https://promptgenerator.fyi
   http://localhost:8082
   ```

3. Also add to **Authorized redirect URIs**:

   ```
   https://promptgenerator.fyi/auth-callback.html
   http://localhost:8082/auth-callback.html
   ```

4. No code change needed — this client is already the first candidate.

---

## Step 2 — Verify

Open the site, click **Sign in with Google**, and sign in with a Google
account.

You should see:
- The popup opens on Google's consent screen (not an error page).
- After consent, the account name appears in the sidebar.
- The sidebar switches to **Sign out** and the plan pill updates.

If you instead see Google's *"You can't sign in to this app because it
doesn't comply with Google's OAuth 2.0 policy"* page, the origin is
still not registered — re-check Step 1.

---

## Step 3 — Only needed for Option B: widen the Firebase API key

If you chose Option B and later want to use Firebase's own Auth SDK, the
API key's referrer restrictions must also allow this site.

1. Cloud Console → **APIs & Services → Credentials → API keys**
2. Find the key used by project `1097186279139` (it is marked
   "Browser key (auto created by Firebase)").
3. Edit → **HTTP referrers**. Add:

   ```
   https://promptgenerator.fyi/*
   http://localhost:8082/*
   ```

4. Save.

The current app does **not** require this — the shared `auth.js` module
talks to Google and to the Cloud Run backend directly, so the API key is
never used for sign-in. It is only needed if you later migrate to the
Firebase Auth SDK.

---

## Why one client works for both the website and the Chrome extension

Both the extension and the website resolve identity through the **same**
backend endpoint, `/verify-google-token`, which calls Google's
`https://www.googleapis.com/oauth2/v2/userinfo` and uses the global
`userinfo.id` as the account uid.

That means:
- Signing in on the website and in the extension resolve to the **same**
  account id.
- A Pro subscription bought on the website is recognized in the extension,
  and vice versa.
- Adding a new OAuth client does **not** fragment existing accounts.

The extension keeps using its own Chrome-extension-type client, which
continues to work exactly as before.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Popup never opens | Browser blocked popups | Allow popups for the site |
| *"popup_blocked"* message | Same | Allow popups, then retry |
| Google: `redirect_uri_mismatch` | Origin not registered | Complete Step 1 |
| Google: `origin_mismatch` | Same | Complete Step 1 |
| Google: *"OAuth client was not found"* | Client deleted | Use Option A |
| *"Sign-in is not configured for this site yet"* | No candidate authorized | Complete Step 1, then hard-refresh |
| Signed in but still "Free" | Subscription not linked | Check `/subscription-status/<uid>` on the backend |

To re-check which clients are configured, open the browser console on the
site and run:

```js
await PHGAuth.detectFlow('1097186279139-8deig9lgvgj8korv12fbaj81la3qk079.apps.googleusercontent.com')
```

It returns `'implicit'` for a confidential client, `'code'` for a public
client, or `null` if the client no longer exists.
