import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

/**
 * Shared YUDO Supabase project (Yuddha.Pro + SATARANGA).
 * The browser only ever sees the publishable/anon key. The service role stays
 * off this client.
 */
export function supabasePublic(): { url: string | undefined; key: string | undefined } {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return { url, key };
}

export function supabaseConfigured(): boolean {
  const { url, key } = supabasePublic();
  return Boolean(url && key);
}

function readEnv(name: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[name]?.trim();
  if (fromVite) return fromVite;
  if (typeof process !== "undefined") {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

let browserClient: SupabaseClient | null = null;

/** Browser client. Null when the public URL or key is not set, and during SSR. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const { url, key } = supabasePublic();
  if (!url || !key) return null;
  browserClient ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  });
  return browserClient;
}

export type AuthProviders = { email: boolean; google: boolean; x: boolean };

/** Which providers the shared project currently has switched on. */
export async function loadAuthProviders(): Promise<AuthProviders> {
  const { url, key } = supabasePublic();
  if (!url || !key) return { email: false, google: false, x: false };
  const response = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
  });
  if (!response.ok) return { email: true, google: false, x: false };
  const body = (await response.json()) as { external?: { email?: boolean; google?: boolean; twitter?: boolean } };
  return {
    email: body.external?.email !== false,
    google: Boolean(body.external?.google),
    x: Boolean(body.external?.twitter),
  };
}

export function userFromSupabase(user: User | null | undefined): {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
} | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username) ||
    null;
  const image =
    (typeof meta.avatar_url === "string" && meta.avatar_url) ||
    (typeof meta.picture === "string" && meta.picture) ||
    null;
  return {
    id: user.id,
    displayName: name,
    primaryEmail: user.email ?? null,
    profileImageUrl: image,
  };
}

export async function signOut(redirectTo = "/"): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
  window.location.href = redirectTo;
}
