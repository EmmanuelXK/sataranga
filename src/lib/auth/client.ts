/**
 * Sign-in is the shared YUDO Supabase project, not Better Auth.
 * `authEnabled` stays the template flag from `.grok/app-env.json`.
 */
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED !== "false";

/** Preview bearer tokens belonged to Better Auth. Supabase keeps its own session. */
export function getBearerToken(): string | null {
  return null;
}
