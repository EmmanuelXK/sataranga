import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { SignedIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { isPending } = useCurrentUserState();
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
      <div className="yd-welcome">
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
                onSubmit={submit}
              />
            )}
          </>
        ) : (
          <p className="yd-fine">Sign-in is not available.</p>
        )}
        <Link to="/" className="login-quiet">
          Play as a guest
        </Link>
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
  onSubmit: (event: FormEvent) => void;
}) {
  const { user } = useCurrentUserState();
  if (user) return null;
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
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            autoComplete="name"
            maxLength={24}
            aria-label="Name"
          />
        )}
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          type="email"
          autoComplete="email"
          required
          aria-label="Email"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          type="password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          required
          minLength={8}
          aria-label="Password"
        />
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="yd-play" disabled={busy}>
          {busy ? "One moment…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="login-or">or</p>
      <div className="login-actions">
        {GROK_PROVIDERS.map((provider) => (
          <button
            key={provider.providerId}
            type="button"
            className="yd-battle"
            onClick={() => signIn(provider.providerId, { callbackURL: "/" })}
          >
            Continue with {provider.label}
          </button>
        ))}
      </div>
    </>
  );
}
