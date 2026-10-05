const KEY = "yuddha-profile-v1";

/** `YYYY-M-D` (unpadded) → comparable day number. Invalid keys sort first. */
export function claimDayValue(key: string): number {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(key);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return 0;
  return year * 10000 + month * 100 + day;
}

function gamesPlayed(row: { wins: number; losses: number; draws: number }): number {
  return row.wins + row.losses + row.draws;
}

/**
 * This device should keep its copy when it has progressed past the server row.
 * Equal records are not "newer" — the server copy can win those.
 */
export function profileIsNewer(
  local: Pick<Profile, "wins" | "losses" | "draws" | "heads" | "coins" | "lastClaim">,
  remote: Pick<Profile, "wins" | "losses" | "draws" | "heads" | "coins" | "lastClaim">,
): boolean {
  const localGames = gamesPlayed(local);
  const remoteGames = gamesPlayed(remote);
  if (localGames !== remoteGames) return localGames > remoteGames;
  if (local.heads !== remote.heads) return local.heads > remote.heads;
  const localClaim = claimDayValue(local.lastClaim);
  const remoteClaim = claimDayValue(remote.lastClaim);
  if (localClaim !== remoteClaim) return localClaim > remoteClaim;
  if (local.coins !== remote.coins) return local.coins > remote.coins;
  return false;
}

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
  /** SENAA (Chathuraja) wins. Missing on older saves. */
  senaWins?: number;
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
  return { v: 1, coins: 0, rating: 400, wins: 0, losses: 0, draws: 0, heads: 0, streak: 0, lastClaim: "", senaWins: 0 };
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
    base.senaWins = Number(data.senaWins) || 0;
    return base;
  } catch {
    return fresh();
  }
}

function write(p: Profile): Profile {
  localStorage.setItem(KEY, JSON.stringify(p));
  if (!holdSync) enqueuePush(p);
  return p;
}

/** Put an earlier record back (undo of a result that was already saved). */
export function replaceProfile(next: Profile): Profile {
  return write({ ...next, v: 1 });
}

let holdSync = false;

type AccountPush = {
  coins: number;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  heads: number;
  streak: number;
  lastClaim: string;
};

let pushQueue: Promise<void> = Promise.resolve();

function enqueuePush(p: Profile) {
  const data: AccountPush = {
    coins: p.coins,
    rating: p.rating,
    wins: p.wins,
    losses: p.losses,
    draws: p.draws,
    heads: p.heads,
    streak: p.streak,
    lastClaim: p.lastClaim,
  };
  pushQueue = pushQueue.catch(() => undefined).then(() => sendAccount(data));
}

function applyLocal(p: Profile): Profile {
  holdSync = true;
  try {
    return write(p);
  } finally {
    holdSync = false;
  }
}

async function sendAccount(data: AccountPush) {
  try {
    const { accountSignedIn, saveAccount } = await import("@/game/account");
    if (!(await accountSignedIn())) return;
    await saveAccount({ data });
  } catch {
    /* guest, or the account table is still starting */
  }
}

/** Pull the signed-in war record onto this device. No-op for a guest. */
export async function hydrateAccount(): Promise<Profile | null> {
  try {
    const { accountSignedIn, loadAccount } = await import("@/game/account");
    if (!(await accountSignedIn())) return null;
    await pushQueue;
    const remote = await loadAccount();
    const local = loadProfile();
    if (!remote || profileIsNewer(local, remote)) {
      enqueuePush(local);
      return local;
    }
    return applyLocal({ v: 1, ...remote, senaWins: local.senaWins ?? 0 });
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

/** MAHA YUDDHA opens after five SATARANGA wins and five SENAA wins. */
export function mahaUnlocked(p: Pick<Profile, "wins" | "senaWins">): boolean {
  return p.wins >= 5 && (p.senaWins ?? 0) >= 5;
}

/** A finished SENAA game where the player (Red, versus three) led. */
export function noteSenaWin(): Profile {
  const p = loadProfile();
  p.senaWins = (p.senaWins ?? 0) + 1;
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
