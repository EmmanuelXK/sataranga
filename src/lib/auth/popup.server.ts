/**
 * The live-preview popup route stays mounted so Vite does not paint the app there.
 * SATARANGA sign-in is the shared Supabase page at /login, not this popup.
 */
export async function handleAuthPopupRequest(): Promise<Response> {
  return new Response("Sign in on the SATARANGA page.", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
