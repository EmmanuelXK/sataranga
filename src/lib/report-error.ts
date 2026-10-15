/**
 * Lightweight error hook. No paid service.
 * If VITE_SENTRY_DSN is set later, this is the one place that should forward.
 * Leave the variable empty until an owner chooses a collector.
 */
const DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined)?.trim() ?? "";

export function reportError(error: unknown, where = "window"): void {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof sessionStorage !== "undefined") {
    try {
      sessionStorage.setItem("sataranga-last-error", `${where}: ${message}`.slice(0, 500));
    } catch {
      /* private mode */
    }
  }
  console.error("[sataranga]", where, error);
  if (DSN) {
    // Placeholder. Do not send the DSN anywhere from this build.
    console.info("[sataranga] error collector configured");
  }
}
