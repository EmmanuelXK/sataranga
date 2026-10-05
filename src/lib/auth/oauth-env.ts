/**
 * Which sign-in methods this process can actually complete.
 *
 * Direct Google and X use the owner's own OAuth apps. The Grok broker is a
 * fallback when those apps are not set: an explicit `GROK_AUTH_*` client, or
 * the baked preview client on `*.grok-sandbox.com`. Nothing here invents a user.
 */

export type ProviderMode = "direct" | "broker" | "missing";

export type AuthSetup = {
  /** Email/password is switched on in code. */
  email: boolean;
  google: ProviderMode;
  x: ProviderMode;
  /** Env names still required before an account can be stored on this host. */
  blockers: string[];
};

const env = (key: string): string | undefined => {
  if (typeof process === "undefined") return undefined;
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

export type OAuthCredentials = { clientId: string; clientSecret: string };

export function googleOAuthFromEnv(): OAuthCredentials | null {
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Accepts the X console names, or Better Auth's `TWITTER_*` aliases. */
export function xOAuthFromEnv(): OAuthCredentials | null {
  const clientId = env("X_CLIENT_ID") ?? env("TWITTER_CLIENT_ID");
  const clientSecret = env("X_CLIENT_SECRET") ?? env("TWITTER_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function brokerAvailable(host: string | undefined): boolean {
  if (env("GROK_AUTH_CLIENT_ID") && env("GROK_AUTH_CLIENT_SECRET")) return true;
  return Boolean(host && (host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com")));
}

function mode(direct: OAuthCredentials | null, host: string | undefined): ProviderMode {
  if (direct) return "direct";
  if (brokerAvailable(host)) return "broker";
  return "missing";
}

/** `host` is the request hostname, without a port. */
export function readAuthSetup(host?: string): AuthSetup {
  const onVercel = Boolean(env("VERCEL"));
  const blockers: string[] = [];
  if (onVercel && !env("BETTER_AUTH_SECRET")) blockers.push("BETTER_AUTH_SECRET");
  if (onVercel && !env("DATABASE_URL")) blockers.push("DATABASE_URL");
  return {
    email: true,
    google: mode(googleOAuthFromEnv(), host),
    x: mode(xOAuthFromEnv(), host),
    blockers,
  };
}
