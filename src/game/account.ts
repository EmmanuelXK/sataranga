import { getSupabase } from "@/lib/supabase/client";

export type SavedProfile = {
  coins: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  heads: number;
  streak: number;
  lastClaim: string;
};

function clean(input: unknown): SavedProfile {
  const d = (input ?? {}) as Partial<SavedProfile> & { last_claim?: string };
  const n = (v: unknown, min: number, max: number, fallback: number) => {
    const x = Math.round(Number(v));
    if (!Number.isFinite(x)) return fallback;
    return Math.min(max, Math.max(min, x));
  };
  return {
    coins: n(d.coins, 0, 1_000_000, 0),
    rating: n(d.rating, 100, 4000, 400),
    wins: n(d.wins, 0, 100_000, 0),
    losses: n(d.losses, 0, 100_000, 0),
    draws: n(d.draws, 0, 100_000, 0),
    heads: n(d.heads, 0, 10, 0),
    streak: n(d.streak, 0, 7, 0),
    lastClaim: typeof d.lastClaim === "string" ? d.lastClaim.slice(0, 16) : typeof d.last_claim === "string" ? d.last_claim.slice(0, 16) : "",
  };
}

/** True when a Supabase session is on this device. Guest play is false. */
export async function accountSignedIn(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session?.user.id);
}

/** The signed-in player's SATARANGA row, or null when there is no row yet. */
export async function loadAccount(): Promise<SavedProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("sataranga_profile")
    .select("coins, rating, wins, losses, draws, heads, streak, last_claim")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return clean(data);
}

/** Write this device's SATARANGA record onto the shared user. No-op for a guest. */
export async function saveAccount(input: { data: SavedProfile }): Promise<SavedProfile | null> {
  const data = clean(input.data);
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { error } = await supabase.from("sataranga_profile").upsert(
    {
      user_id: userId,
      coins: data.coins,
      rating: data.rating,
      wins: data.wins,
      losses: data.losses,
      draws: data.draws,
      heads: data.heads,
      streak: data.streak,
      last_claim: data.lastClaim,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);
  return data;
}
