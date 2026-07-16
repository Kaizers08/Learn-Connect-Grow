# Google Sign-In — Client Guide

**Platform:** Learn, Connect, Grow (EdTech Mentoring Platform)
**Feature:** Sign in with Google (OAuth)
**Audience:** Client / Stakeholders

---

## 1. What it is

**Sign in with Google** lets users open an account or log in using their Google account instead of typing an email and password.

On the Login page, users click **Sign in with Google**, choose a Google account, approve access, and return to the platform already signed in. New users are guided through the same onboarding steps as email sign-up (choose role, complete profile, and so on). Existing users with a finished profile go straight to the **Dashboard**.

---

## 2. Where to find it

- **Login page** (`/login`) — **Sign in with Google** button under the email/password form
- Users land back on the app after Google approval (via a short “Signing you in…” callback page)

Email/password login and **Forgot Password?** still work as usual. Google is an extra option, not a replacement.

---

## 3. User experience (step by step)

### Signing in with Google

1. Open the **Login** page.
2. Click **Sign in with Google**.
3. A Google window opens — pick a Google account (or sign into Google if needed).
4. Approve the request to continue to the platform.
5. The app briefly shows **Signing you in…** while it finishes the login.
6. The user is sent to the right place:

| User situation | Where they go |
|----------------|---------------|
| Profile already complete | **Dashboard** |
| New Google user (no role yet) | **Complete profile** (choose Mentor or Mentee) |
| Profile incomplete | Mentor or mentee profile setup |
| Mentor documents pending | Mentor documents upload |
| Mentor waiting for approval | Pending approval page |
| Admin account | Admin panel |

### What Google shares with the platform

When the user approves, Google provides basic identity info such as:

- Email address
- Name
- Profile picture (if available)

The platform does **not** get the user’s Google password. Login is handled by Google; the app only receives a secure confirmation that this person is who they say they are.

---

## 4. How it differs from email login

| | **Email / password** | **Google Sign-In** |
|---|----------------------|---------------------|
| Credentials | User creates and remembers a password | Uses existing Google account |
| Forgot password | Reset link by email | Managed in Google Account settings |
| New users | Register → complete profile | Google → complete profile (same onboarding) |
| Where session starts | Stays on the login page | Redirects through Google, then back to the app |

Both methods create a normal platform session. After login, mentors and mentees use the same Dashboard, Resources, Schedules, and Messages features.

---

## 5. Production vs local (important)

Google Sign-In works on:

- **Local development** — e.g. `http://localhost:4200`
- **Live hosting** — e.g. `https://enodd-dev-01.vercel.app`

For production, the live site URL must be listed in **Supabase URL Configuration**. If it is missing, Google may appear to work, then send the user back to the home page instead of finishing login.

**Typical production URLs to allow:**

```
https://enodd-dev-01.vercel.app
https://enodd-dev-01.vercel.app/**
https://enodd-dev-01.vercel.app/auth/callback
```

Local URLs should stay allowed too for development:

```
http://localhost:4200/**
http://localhost:4200/auth/callback
```

---

## 6. Design & experience

- Same Login page styling as email sign-in (brand colors, Google button with official Google colors).
- After Google approval, a simple **Signing you in…** screen avoids a blank or broken page.
- New Google users follow the same role and profile journey as email users — no separate “Google-only” onboarding.
- Works on desktop and mobile browsers that support Google OAuth.

---

## 7. Good to know

- **Owner / Admin required in Supabase** to turn Google on and paste Client ID / Secret. A **Developer** role can view auth settings but cannot save provider credentials.
- Google Cloud must use an **OAuth client** (Web application), not only an API key or Express / Agent Platform mode.
- The Google redirect URI must be the **Supabase callback**, not the Vercel site URL:
  `https://wblacddvxokokjcwnnrm.supabase.co/auth/v1/callback`
- First-time Google users still need to pick **Mentor** or **Mentee** and finish their profile before using the full Dashboard.
- Treat Client IDs and Secrets as sensitive. If a secret was shared in chat or screenshots, regenerate it in Google Cloud and update Supabase.

---

## 8. How it was built (light technical overview)

Plain-language summary of setup — not a deep developer manual.

### The building blocks

- **Front-end:** Angular Login page calls Supabase’s Google OAuth flow. After Google, users return to `/auth/callback`, which saves the session and routes them to the correct page.
- **Auth provider:** **Supabase Auth** with the **Google** provider enabled.
- **Identity provider:** **Google Cloud OAuth 2.0** (Web client) for the consent screen and tokens.
- **Hosting:** Production runs on **Vercel** (static Angular build). SPA routes like `/auth/callback` must rewrite to `index.html` so they do not return a Vercel `404: NOT_FOUND`.

### How a Google login flows

1. User clicks **Sign in with Google** on `/login`.
2. The app asks Supabase to start Google OAuth, with a return URL of  
   `{site}/auth/callback` (localhost or Vercel domain).
3. User authenticates on Google and approves the app.
4. Google sends the user to Supabase’s callback  
   (`https://…supabase.co/auth/v1/callback`).
5. Supabase redirects the user back to the app at `/auth/callback` with a one-time code.
6. The app exchanges that code for a session (secure login cookie/storage).
7. The app checks registration status (role, profile, documents, approval) and navigates to the right screen (usually **Dashboard** if complete).

```
Login page → Google → Supabase Auth → /auth/callback → Dashboard (or onboarding)
```

### Setup (what was needed)

1. **Google Cloud Console**
   - Create (or use) a project (full console — not Express / Agent-only mode).
   - Configure the **OAuth consent screen** (External is fine for testing).
   - Create credentials → **OAuth client ID** → type **Web application**.
   - Add **Authorized redirect URI**:  
     `https://wblacddvxokokjcwnnrm.supabase.co/auth/v1/callback`
   - Copy **Client ID** and **Client Secret**.

2. **Supabase Dashboard**
   - **Authentication → Providers → Google** → Enable.
   - Paste Client ID and Client Secret → Save (Owner/Admin only).
   - **Authentication → URL Configuration**
     - Site URL = live Vercel URL (e.g. `https://enodd-dev-01.vercel.app`)
     - Redirect URLs include Vercel `/**`, `/auth/callback`, and localhost equivalents.

3. **App code**
   - `signInWithGoogle()` redirects to `/auth/callback`.
   - Auth callback page waits for the session, then routes by registration status.
   - Auth guard waits for the session before protecting `/dashboard`.

4. **Vercel hosting**
   - Build must expose `index.html` for SPA routing (Angular 21 may produce `index.csr.html`; the deploy script copies it to `index.html`).
   - Rewrites send non-file routes to `index.html` so `/login` and `/auth/callback` do not 404.

### Notes for future maintenance

- **New domain:** Add the new URL to Supabase Site URL / Redirect URLs (and redeploy if needed). Google Cloud redirect stays on the Supabase callback URL unless the Supabase project changes.
- **Rotate secrets:** If Client Secret is exposed, create a new secret in Google Cloud and update Supabase → Google provider.
- **Testing vs production:** Keep both localhost and production URLs in the allow list while developing.
- **Google verification:** For wide public release beyond test users, Google may require OAuth verification / branding review on the consent screen.
