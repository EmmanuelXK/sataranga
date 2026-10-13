import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

const ENTER_KEY = "sataranga-enter";
const SEEN_KEY = "yuddha-seen-v1";
const OPEN_KEY = "sataranga-open-signin";
const ERROR_KEY = "sataranga-auth-error";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { isPending, user } = useCurrentUserState();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending) return;
    const real = Boolean(user && !user.isDevFallback);
    try {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const description = params.get("error_description") || params.get("error") || hash.get("error_description") || hash.get("error");
      if (description) sessionStorage.setItem(ERROR_KEY, description.replace(/\+/g, " "));
      if (real) {
        sessionStorage.setItem(ENTER_KEY, "1");
        localStorage.setItem(SEEN_KEY, "1");
      } else {
        sessionStorage.setItem(OPEN_KEY, "1");
      }
    } catch {
      /* still return to the board */
    }
    const timer = window.setTimeout(() => {
      void navigate({ to: "/" });
    }, real ? 280 : 0);
    return () => window.clearTimeout(timer);
  }, [isPending, user, navigate]);

  return (
    <main className="shell play ms-game">
      <p className="leather-hold">Opening the board…</p>
    </main>
  );
}
