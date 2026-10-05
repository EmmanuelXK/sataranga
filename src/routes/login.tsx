import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn, signInDirect } from "@/lib/auth/client";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { getAuthSetup, type ProviderMode } from "@/lib/auth/setup";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  loader: () => getAuthSetup(),
  component: Login,
});

function Login() {
  const setup = Route.useLoaderData();
  const { isPending, user } = useCurrentUserState();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const result =
        mode === "up"
          ? await authClient.signUp.email({
              email: email.trim(),
              password,
              name: name.trim().slice(0, 24) || "Player",
            })
          : await authClient.signIn.email({
              email: email.trim(),
              password,
            });
      if (result.error) {
        setError(result.error.message || "That account did not open.");
        return;
      }
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That account did not open.");
    } finally {
      setBusy(false);
    }
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
            {!isPending && (
              <AccountForm
                mode={mode}
                setMode={setMode}
                name={name}
                setName={setName}
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                error={error}
                busy={busy}
                blocked={setup.blockers.length > 0}
                blockers={setup.blockers}
                google={setup.google}
                x={setup.x}
                onSubmit={submit}
              />
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

function AccountForm({
  mode,
  setMode,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  error,
  busy,
  blocked,
  blockers,
  google,
  x,
  onSubmit,
}: {
  mode: "in" | "up";
  setMode: (mode: "in" | "up") => void;
  name: string;
  setName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  error: string;
  busy: boolean;
  blocked: boolean;
  blockers: string[];
  google: ProviderMode;
  x: ProviderMode;
  onSubmit: (event: FormEvent) => void;
}) {
  const { user } = useCurrentUserState();
  const [oauthError, setOauthError] = useState("");
  if (user) return null;

  async function startProvider(which: "google" | "x") {
    setOauthError("");
    const ready = which === "google" ? google : x;
    if (ready === "missing") return;
    try {
      if (ready === "direct") {
        await signInDirect(which === "google" ? "google" : "twitter", { callbackURL: "/" });
        return;
      }
      const provider = GROK_PROVIDERS.find((item) => item.idp === (which === "google" ? "google" : "twitter"));
      if (!provider) return;
      await signIn(provider.providerId, { callbackURL: "/" });
    } catch (err) {
      setOauthError(err instanceof Error ? err.message : "That sign-in did not open.");
    }
  }

  return (
    <>
      <div className="seg3 login-seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "up"} className={mode === "up" ? "on" : ""} onClick={() => setMode("up")}>
          Create
        </button>
        <button type="button" role="tab" aria-selected={mode === "in"} className={mode === "in" ? "on" : ""} onClick={() => setMode("in")}>
          Sign in
        </button>
      </div>
      <form className="login-form" onSubmit={onSubmit}>
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
        {blocked ? (
          <p className="login-error">This deployment still needs {blockers.join(" and ")} before an account can be saved.</p>
        ) : null}
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="yd-play" disabled={busy || blocked}>
          {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="login-or">or</p>
      <div className="login-actions">
        <button type="button" className="yd-battle" disabled={google === "missing"} onClick={() => startProvider("google")}>
          Continue with Google
        </button>
        {google === "missing" ? (
          <p className="login-note">Google needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.</p>
        ) : null}
        <button type="button" className="yd-battle" disabled={x === "missing"} onClick={() => startProvider("x")}>
          Continue with X
        </button>
        {x === "missing" ? (
          <p className="login-note">X needs X_CLIENT_ID and X_CLIENT_SECRET on the server.</p>
        ) : null}
        {oauthError ? <p className="login-error">{oauthError}</p> : null}
      </div>
    </>
  );
}
