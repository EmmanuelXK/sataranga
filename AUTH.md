# Account setup

SATARANGA signs in with **Supabase Auth** on the shared YUDO project (`sphswtyzxaanjcibnnln`), the same `auth.users` as Yuddha.Pro. Do not set `BETTER_AUTH_*` for this gate. Do not create a second Google client for SATARANGA.

Copy these onto the SATARANGA Vercel project (Production and Preview), from the Yuddha.Pro Vercel project or from Supabase → Project Settings → API. Then redeploy.

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sphswtyzxaanjcibnnln.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key, or the publishable key (`sb_publishable_…`). `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is accepted as the same slot. |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used by SATARANGA sign-in or progress. Do not put it in the client. |
| `DATABASE_URL` / `POSTGRES_URL` | Not required for sign-in. Leave the existing app database if one is already set. Do not point the build’s `DATABASE_URL` at YUDO: the app migrate still carries an old Better Auth schema file and must not apply it to the shared project. |

## What is shared

- `auth.users`, identities, and sessions. A Yuddha.Pro account signs in here, and the reverse.
- `public.profiles` is created by YUDO’s `handle_new_user` trigger (display name from `full_name` / `name`). SATARANGA does not overwrite that row.
- `public.family_ratings` already seeds `sataranga`, `maha-sena`, and `yuddha-pro`. SATARANGA does not write those ratings.
- SATARANGA progress (coins, rating, wins, heads, streak) is `public.sataranga_profile`, keyed by `auth.users.id`, with row security so a player can only read and write their own row. SQL is in `supabase/sataranga_profile.sql`. It is already applied on YUDO.

## Email and password

No extra provider. Create and Sign in call `signUp` / `signInWithPassword`. The project currently auto-confirms email. Name is stored as `full_name` so the shared profile trigger can show it.

## Google

Continue with Google calls `supabase.auth.signInWithOAuth({ provider: "google" })` on this shared project. It does not use `GROK_AUTH_*`, Better Auth, or a Google client stored in SATARANGA.

Supabase then sends the player to Google with this client id:

`129009373354-97cc4lospcgmdr6sbjt1i2l2a0imnh1j.apps.googleusercontent.com`

Google currently answers `deleted_client`: “The OAuth client was deleted.” That is the same failure Yuddha.Pro shows. The redirect URI on that request is already the Supabase callback, and these return URLs are already accepted by the project:

- `https://sataranga.vercel.app/login`
- `https://sataranga-blitzbar.vercel.app/login`
- `https://sataranga-git-cursor-sataranga-audit-fixes-ded9-blitzbar.vercel.app/login`
- `http://localhost:8080/login`

Yuddha.Pro returns to `https://yuddha.pro/` (the site root). Adding allow-list rows does not revive a deleted Google client. No new client secret belongs in this repo.

### Restore the existing client

Do this first. If Google still has the client, the id and secret already saved in Supabase start working again. No SATARANGA redeploy.

1. Open [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients?project=129009373354) for project number `129009373354`.
2. Open **Deleted credentials** (clients deleted in the last 30 days).
3. Restore the client whose id is `129009373354-97cc4lospcgmdr6sbjt1i2l2a0imnh1j.apps.googleusercontent.com`.
4. Confirm its authorized redirect URI is exactly `https://sphswtyzxaanjcibnnln.supabase.co/auth/v1/callback`.

A client deleted more than 30 days ago cannot be restored.

### If it cannot be restored, create a replacement

1. On that same Clients page, click **Create client**.
2. Application type: **Web application**.
3. Name: `YUDO` (one client for Yuddha.Pro and SATARANGA).
4. Authorized redirect URI — this one only:

   `https://sphswtyzxaanjcibnnln.supabase.co/auth/v1/callback`

   Do not put `https://yuddha.pro/` or a SATARANGA `/login` URL here. Those are return URLs inside Supabase, not Google’s redirect.
5. Create the client. Copy the **Client ID** and the **Client secret** immediately. Google shows the secret once. Do not commit either value.
6. Supabase → project `sphswtyzxaanjcibnnln` → **Authentication** → **Sign In / Providers** → **Google**.
7. Leave Google enabled. Replace Client ID and Client Secret with the new pair. Save.

### Return URLs to keep in Supabase

Supabase → **Authentication** → **URL Configuration** → **Redirect URLs**. Site URL can stay the Yuddha.Pro origin. Add:

- `https://yuddha.pro/**`
- `https://sataranga.vercel.app/**`
- `https://sataranga-blitzbar.vercel.app/**`
- `https://sataranga-git-cursor-sataranga-audit-fixes-ded9-blitzbar.vercel.app/**`
- `http://localhost:8080/**`

Changing the Google client in Supabase does not require a SATARANGA redeploy. A redeploy is required only when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` was missing on that deployment.

## X

X is **not** enabled (`external.twitter: false`). Continue with X stays disabled until it is turned on. It does not create a session.

To enable it: Supabase → Authentication → Providers → Twitter (X). In the X developer app, the callback is the same Supabase URL:

`https://sphswtyzxaanjcibnnln.supabase.co/auth/v1/callback`

No SATARANGA env var. The button reads `/auth/v1/settings` and turns on when `twitter` is true.

## Guest

Play as a guest opens the board with no Supabase session. The rating stays on that device.
