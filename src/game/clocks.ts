/** Display clocks from server timestamps. The client never owns the remaining time. */

export function displayClocks(input: {
  whiteMs: number;
  blackMs: number;
  side: "w" | "b";
  clockUpdatedAt: number;
  serverNow: number;
  clientNow: number;
  running: boolean;
}): { w: number; b: number } {
  if (!input.running) return { w: input.whiteMs, b: input.blackMs };
  const skew = input.serverNow - input.clientNow;
  const elapsed = Math.max(0, input.clientNow + skew - input.clockUpdatedAt);
  if (input.side === "w") return { w: Math.max(0, input.whiteMs - elapsed), b: input.blackMs };
  return { w: input.whiteMs, b: Math.max(0, input.blackMs - elapsed) };
}
