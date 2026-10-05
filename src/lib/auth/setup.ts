import { createServerFn } from "@tanstack/react-start";
import type { AuthSetup } from "./oauth-env";

export type { AuthSetup, ProviderMode } from "./oauth-env";

/** Which account buttons can complete on this request's host. No secrets leave the server. */
export const getAuthSetup = createServerFn({ method: "GET" }).handler(async (): Promise<AuthSetup> => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const { readAuthSetup } = await import("./oauth-env");
  const host = getRequest()?.headers.get("host")?.split(":")[0];
  return readAuthSetup(host);
});
