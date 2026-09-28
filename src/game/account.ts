import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type SavedProfile = {
  coins: number;
  rating: number;
  wins: number;
  heads: number;
  streak: number;
  lastClaim: string;
};

function clean(input: unknown): SavedProfile {
  const d = (input ?? {}) as Partial<SavedProfile>;
  const n = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Math.round(Number(v));
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
  };
  return {
    coins: n(d.coins, 0, 1_000_000, 0),
    rating: n(d.rating, 100, 4000, 400),
    wins: n(d.wins, 0, 100_000, 0),
    heads: n(d.heads, 0, 10, 0),
    streak: n(d.streak, 0, 7, 0),
    lastClaim: typeof d.lastClaim === "string" ? d.lastClaim.slice(0, 16) : "",
  };
}

export const loadAccount = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      coins: number;
      rating: number;
      wins: number;
      heads: number;
      streak: number;
      lastClaim: string;
    }>`select coins, rating, wins, heads, streak, last_claim as "lastClaim"
       from sataranga_profile where user_id = ${context.userId} limit 1`;
    const row = rows[0];
    if (!row) return null;
    return clean(row);
  });

export const saveAccount = createServerFn({ method: "POST" })
  .validator((input: unknown) => clean(input))
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`insert into sataranga_profile
        (user_id, coins, rating, wins, heads, streak, last_claim, updated_at)
      values (
        ${context.userId}, ${data.coins}, ${data.rating}, ${data.wins},
        ${data.heads}, ${data.streak}, ${data.lastClaim}, now()
      )
      on conflict (user_id) do update set
        coins = excluded.coins,
        rating = excluded.rating,
        wins = excluded.wins,
        heads = excluded.heads,
        streak = excluded.streak,
        last_claim = excluded.last_claim,
        updated_at = now()`;
    return data;
  });
