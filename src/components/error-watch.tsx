import { useEffect } from "react";
import { reportError } from "@/lib/report-error";

/** Catches crashes the React tree does not. Registers the offline bot cache in production. */
export function ErrorWatch() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "error");
    const onReject = (event: PromiseRejectionEvent) => reportError(event.reason, "rejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onReject);
    };
  }, []);
  return null;
}
