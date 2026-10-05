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

Already enabled on this project (`external.google: true`). It is configured in Supabase → Authentication → Providers → Google, not with `GOOGLE_CLIENT_*` on SATARANGA.

Google’s redirect URI is the Supabase callback, not this app:

`https://sphswtyzxaanjcibnnln.supabase.co/auth/v1/callback`

In Supabase → Authentication → URL Configuration, add every SATARANGA origin players return to (the preview URL changes per deploy; add the stable production origin too):

- `https://YOUR_SATARANGA_HOST/login`
- `http://localhost:8080/login`

Site URL can stay the Yuddha.Pro origin. Extra redirect URLs are enough.

## X

X is **not** enabled (`external.twitter: false`). Continue with X stays disabled until it is turned on. It does not create a session.

To enable it: Supabase → Authentication → Providers → Twitter (X). In the X developer app, the callback is the same Supabase URL:

`https://sphswtyzxaanjcibnnln.supabase.co/auth/v1/callback`

No SATARANGA env var. The button reads `/auth/v1/settings` and turns on when `twitter` is true.

## Guest

Play as a guest opens the board with no Supabase session. The rating stays on that device.
