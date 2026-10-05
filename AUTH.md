# Account setup

Email, Google, and X sign-in use this app's Better Auth at `/api/auth/*`. Guest play does not create a user. Set the values in the Vercel project (Production and Preview). Do not commit them.

`YOUR_HOST` below is the site origin with no path, for example `https://sataranga.vercel.app`. Add the same paths for every host people actually sign in on, including a preview host such as `https://sataranga-abc123-blitzbar.vercel.app`, and `http://localhost:8080` if you test locally. The callback host is the host in the address bar.

## Email and password

| Variable | What to set |
| --- | --- |
| `BETTER_AUTH_SECRET` | Long random string. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `YOUR_HOST` |
| `DATABASE_URL` | Postgres connection string for this app |

No OAuth callback. Name, email, and password are stored in this app's `user` table. On Vercel, Create account and Sign in stay disabled until `BETTER_AUTH_SECRET` and `DATABASE_URL` are set, because a session cannot be kept without them.

## Google

Google Cloud Console → APIs & Services → Credentials → OAuth client ID → Web application.

Authorized JavaScript origins:

- `YOUR_HOST`
- `http://localhost:8080`

Authorized redirect URIs:

- `YOUR_HOST/api/auth/callback/google`
- `http://localhost:8080/api/auth/callback/google`

| Variable | What to set |
| --- | --- |
| `GOOGLE_CLIENT_ID` | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |

Until both are set, Continue with Google stays disabled. It does not sign anyone in.

## X

[developer.x.com](https://developer.x.com) → your app → User authentication settings → OAuth 2.0, Web App. Allow the email permission if you want a real address (`users.email`).

Callback URI / Redirect URL:

- `YOUR_HOST/api/auth/callback/twitter`
- `http://localhost:8080/api/auth/callback/twitter`

Website URL: `YOUR_HOST`

Better Auth's provider id for X is `twitter`, so the path ends in `/callback/twitter`.

| Variable | What to set |
| --- | --- |
| `X_CLIENT_ID` | OAuth 2.0 client id |
| `X_CLIENT_SECRET` | OAuth 2.0 client secret |

`TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET` are accepted as the same pair. Until one full pair is set, Continue with X stays disabled.

## Optional Grok broker

If the Google or X variables above are missing, that button can still use the shared broker when both of these are set:

| Variable | What to set |
| --- | --- |
| `GROK_AUTH_CLIENT_ID` | Per-app client from the broker |
| `GROK_AUTH_CLIENT_SECRET` | Matching secret |
| `GROK_AUTH_ISSUER` | Optional. Defaults to `https://auth.grok.me` |

Those callbacks are registered on the broker, not in the Google or X console:

- `YOUR_HOST/api/auth/oauth2/callback/grok-google`
- `YOUR_HOST/api/auth/oauth2/callback/grok-x`

`*.grok-sandbox.com` previews use the built-in preview client and do not need these variables.

## Guest

Play as a guest opens the board with no account. The rating stays on that device.
