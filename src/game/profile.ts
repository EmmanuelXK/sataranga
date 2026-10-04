const KEY = "yuddha-profile-v1";

export type Profile = {
  v: 1;
  coins: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  heads: number;
  streak: number;
  lastClaim: string;
};

const HEADS = [
  "Khara",
  "Dushana",
  "Akampana",
  "Kumbhakarna",
  "Atikaya",
  "Narantaka",
  "Devantaka",
  "Trishira",
  "Indrajit",
  "Ravana",
] as const;

export function headName(n: number): string {
  return HEADS[Math.min(9, Math.max(0, n - 1))] ?? "Ravana";
}

export function headLevel(n: number): 1 | 2 | 3 | 4 {
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  return 4;
}

function fresh(): Profile {
  return { v: 1, coins: 0, rating: 400, wins: 0, losses: 0, draws: 0, heads: 0, streak: 0, lastClaim: "" };
}

export function loadProfile(): Profile {
  if (typeof localStorage === "undefined") return fresh();
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || "") as Partial<Profile>;
    if (data.v !== 1) return fresh();
    const base = fresh();
    base.coins = Number(data.coins) || 0;
    base.rating = Number(data.rating) || 400;
    base.wins = Number(data.wins) || 0;
    base.losses = Number(data.losses) || 0;
    base.draws = Number(data.draws) || 0;
    base.heads = Math.min(10, Number(data.heads) || 0);
    base.streak = Number(data.streak) || 0;
    base.lastClaim = typeof data.lastClaim === "string" ? data.lastClaim : "";
    return base;
  } catch {
    return fresh();
  }
}

function write(p: Profile): Profile {
  localStorage.setItem(KEY, JSON.stringify(p));
  if (!holdSync) void pushAccount(p);
  return p;
}

let holdSync = false;

function applyLocal(p: Profile): Profile {
  holdSync = true;
  try {
    return write(p);
  } finally {
    holdSync = false;
  }
}

async function pushAccount(p: Profile) {
  try {
    const { authEnabled, authClient } = await import("@/lib/auth/client");
    if (!authEnabled) return;
    const session = await authClient.getSession();
    if (!session.data?.user) return;
    const { saveAccount } = await import("@/game/account");
    await saveAccount({
      data: {
        coins: p.coins,
        rating: p.rating,
        wins: p.wins,
        losses: p.losses,
        draws: p.draws,
        heads: p.heads,
        streak: p.streak,
        lastClaim: p.lastClaim,
      },
    });
  } catch {
    /* guest, or the account table is still starting */
  }
}

/** Pull the signed-in war record onto this device. No-op for a guest. */
export async function hydrateAccount(): Promise<Profile | null> {
  try {
    const { authEnabled, authClient } = await import("@/lib/auth/client");
    if (!authEnabled) return null;
    const session = await authClient.getSession();
    if (!session.data?.user) return null;
    const { loadAccount } = await import("@/game/account");
    const remote = await loadAccount();
    if (!remote) {
      await pushAccount(loadProfile());
      return loadProfile();
    }
    return applyLocal({ v: 1, ...remote });
  } catch {
    return null;
  }
}

export const RATED_WIN = 18;
export const RATED_LOSS = 12;

const RANKS = [
  { title: "Hewa", min: 100 },
  { title: "Yodha", min: 400 },
  { title: "Senapati", min: 450 },
  { title: "Gaja", min: 600 },
  { title: "Ratha", min: 800 },
  { title: "Raja", min: 1000 },
] as const;

export function rankProgress(rating: number): {
  title: string;
  next: string | null;
  floor: number;
  ceil: number;
} {
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) if (rating >= RANKS[i].min) index = i;
  const current = RANKS[index];
  const upcoming = RANKS[index + 1];
  return {
    title: current.title,
    next: upcoming?.title ?? null,
    floor: current.min,
    ceil: upcoming?.min ?? current.min,
  };
}

export function rankTitle(rating: number): string {
  return rankProgress(rating).title;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function claimDaily(): Profile {
  const p = loadProfile();
  const today = todayKey();
  if (p.lastClaim === today) return p;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  p.streak = p.lastClaim === yKey ? Math.min(7, p.streak + 1) : 1;
  p.lastClaim = today;
  p.coins += 15 + p.streak * 5;
  return write(p);
}

export function noteBattle(opts: { result: "win" | "loss" | "draw"; rated?: boolean; head?: number }): Profile {
  const p = loadProfile();
  if (opts.result === "win") {
    p.wins += 1;
    p.coins += 12;
    if (opts.rated) p.rating += RATED_WIN;
    if (opts.head && opts.head === p.heads + 1) p.heads = opts.head;
  } else if (opts.result === "loss") {
    p.losses += 1;
    p.coins += 2;
    if (opts.rated) p.rating = Math.max(100, p.rating - RATED_LOSS);
  } else {
    p.draws += 1;
    if (opts.rated) p.coins += 4;
  }
  return write(p);
}
