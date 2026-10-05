import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { authEnabled } from "@/lib/auth/client";
import { getSupabase, loadAuthProviders, supabaseConfigured, type AuthProviders } from "@/lib/supabase/client";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { isPending, user } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [oauthError, setOauthError] = useState("");
  const ready = supabaseConfigured();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const description = params.get("error_description") || params.get("error");
    if (description) setOauthError(description.replace(/\+/g, " "));
  }, []);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    void loadAuthProviders().then((next) => {
      if (live) setProviders(next);
    });
    return () => {
      live = false;
    };
  }, [ready]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const supabase = getSupabase();
    if (!supabase) return;
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const shown = name.trim().slice(0, 24) || "Player";
        const { data, error: signError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: shown, full_name: shown } },
        });
        if (signError) {
          setError(signError.message);
          return;
        }
        if (!data.session) {
          setError("Check your email to confirm, then sign in.");
          setMode("in");
          return;
        }
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signError) {
          setError(signError.message);
          return;
        }
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That account did not open.");
    } finally {
      setBusy(false);
    }
  }

  async function startProvider(provider: "google" | "twitter") {
    setOauthError("");
    const supabase = getSupabase();
    if (!supabase) return;
    const { error: signError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/login`,
        queryParams: provider === "google" ? { prompt: "select_account" } : undefined,
      },
    });
    if (signError) setOauthError(signError.message);
  }

  return (
    <main className="yd">
      <div className="yd-welcome login-screen">
        <p className="yd-kicker brand-kicker">Old Ceylon Chess</p>
        <h1 className="yd-logo">SATARANGA</h1>
        <p className="yd-lead">
          Your account.
          <br />
          Your rating stays with it.
        </p>
        <p className="login-duo">
          This is a Yuddha.Pro company account. It works in both apps. Each game keeps its own progress. Guest play stays on this device.
        </p>
        {isPending ? (
          <p className="yd-fine">Checking your account…</p>
        ) : authEnabled ? (
          <>
            <SignedIn>
              <div className="login-user">
                <UserButton />
              </div>
              <Link to="/" className="yd-play login-home">
                Back to the war room
              </Link>
            </SignedIn>
            {!user && (
              <>
                <div className="seg3 login-seg" role="tablist">
                  <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>
                    Create
                  </button>
                  <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>
                    Sign in
                  </button>
                </div>
                <form className="login-form" onSubmit={submit}>
                  {mode === "up" && (
                    <label className="login-field">
                      <span>Name</span>
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="What should we call you"
                        autoComplete="name"
                        maxLength={24}
                        aria-label="Name"
                        name="name"
                      />
                    </label>
                  )}
                  <label className="login-field">
                    <span>Email</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@email.com"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      required
                      aria-label="Email"
                      name="email"
                    />
                  </label>
                  <label className="login-field">
                    <span>Password</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      type="password"
                      autoComplete={mode === "up" ? "new-password" : "current-password"}
                      required
                      minLength={8}
                      aria-label="Password"
                      name="password"
                    />
                  </label>
                  {!ready ? (
                    <p className="login-error">This deployment needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before an account can be saved.</p>
                  ) : null}
                  {error ? <p className="login-error">{error}</p> : null}
                  <button type="submit" className="yd-play" disabled={busy || !ready}>
                    {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
                  </button>
                </form>
                <p className="login-or">or</p>
                <div className="login-actions">
                  <button type="button" className="yd-battle" disabled={!ready || !providers?.google} onClick={() => startProvider("google")}>
                    Continue with Google
                  </button>
                  {ready && providers && !providers.google ? (
                    <p className="login-note">Google is off in the shared Supabase project.</p>
                  ) : null}
                  <button type="button" className="yd-battle" disabled={!ready || !providers?.x} onClick={() => startProvider("twitter")}>
                    Continue with X
                  </button>
                  {ready && providers && !providers.x ? (
                    <p className="login-note">X isn’t enabled on the shared Supabase project yet.</p>
                  ) : null}
                  {oauthError ? <p className="login-error">{oauthError}</p> : null}
                </div>
              </>
            )}
          </>
        ) : (
          <p className="yd-fine">Sign-in is not available.</p>
        )}
        {!user && (
          <Link to="/" className="login-quiet">
            Play as a guest
          </Link>
        )}
      </div>
    </main>
  );
}
