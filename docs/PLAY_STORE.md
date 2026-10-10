# SATARANGA on the Play Store

This does not publish anything. The owner does that from the Play Console.

## What is already in the repo

- Installable PWA: `public/manifest.webmanifest`, icons in `public/icons/`, and `public/sw.js` so a visited bot game can open again offline.
- Trusted Web Activity config: `twa/twa-manifest.json`. Bubblewrap reads that file. It is not a store listing.

## Owner checklist

1. Pay the Play Console registration fee (USD 25) at https://play.google.com/console if the account is new.
2. Replace the placeholder icons in `public/icons/` when the artist delivers them. They are 192, 512, and a maskable 512.
3. Set the site origin the TWA opens. Production is `https://sataranga.vercel.app`. Put that host in the asset links file Bubblewrap generates.
4. Install Bubblewrap (`npm install -g @bubblewrap/cli`) on a machine with JDK 17 and the Android SDK. From this repo run `bubblewrap init --manifest=https://sataranga.vercel.app/manifest.webmanifest` or `bubblewrap update` against `twa/twa-manifest.json`.
5. `bubblewrap build` produces an AAB. Upload that AAB in Play Console. Do not upload it from this workspace.
6. Play Console → App content: privacy policy URL is `/privacy` on the production host. Replace the placeholders `[Company legal name]` and `[Contact email]` first. A sensible contact is hello@yuddha.pro.
7. Digital Asset Links: host `/.well-known/assetlinks.json` on the production domain with the SHA-256 of the Play signing key. Without it the TWA shows the browser bar.
8. Environment on the Vercel project, then redeploy: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Do not set `DATABASE_URL` to the shared YUDO database. Do not put the service role in the client.
9. Optional: `VITE_SENTRY_DSN` if an error collector is chosen later. Empty means the in-app hook only logs.
10. Confirm Google sign-in separately. The shared OAuth client was deleted. Restoring it is a Google Cloud step, not a Play Console step.

## Package

- Application id in the TWA manifest: `pro.yuddha.sataranga`
- Name: SATARANGA
- Start URL: `/`
