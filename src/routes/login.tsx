import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { SignedIn, UserButton } from "@/lib/auth/gates";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="yd">
      <div className="yd-welcome">
        <p className="yd-kicker brand-kicker">Old Ceylon Chess</p>
        <h1 className="yd-logo">SATARANGA</h1>
        <p className="yd-lead">
          Sign in.
          <br />
          Your rank follows you.
        </p>
        {authEnabled ? (
          <div className="login-actions">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className={p.idp === "google" ? "yd-play" : "yd-battle"}
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="yd-fine">Sign-in is not available.</p>
        )}
        <SignedIn>
          <div className="login-user">
            <UserButton />
          </div>
        </SignedIn>
        <Link to="/" className="login-quiet">
          Play as a guest
        </Link>
      </div>
    </main>
  );
}
