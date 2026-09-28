import type { Level } from "@/game/engine";

const KEY = "chaturanga-career-v1";

export type Tally = { w: number; l: number; d: number };
export type SoloResult = "win" | "loss" | "draw";

export type Career = {
  v: 1;
  name: string;
  bots: Record<Level, Tally>;
  recent: { at: number; opp: string; result: SoloResult }[];
};

const EMPTY: Tally = { w: 0, l: 0, d: 0 };

function fresh(): Career {
  return {
    v: 1,
    name: "You",
    bots: { 1: { ...EMPTY }, 2: { ...EMPTY }, 3: { ...EMPTY }, 4: { ...EMPTY } },
    recent: [],
  };
}

export function loadCareer(): Career {
  if (typeof localStorage === "undefined") return fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const data = JSON.parse(raw) as Partial<Career>;
    if (data.v !== 1) return fresh();
    const base = fresh();
    const name = typeof data.name === "string" && data.name.trim() ? data.name.trim().slice(0, 18) : "You";
    for (const id of [1, 2, 3, 4] as Level[]) {
      const row = data.bots?.[id];
      if (!row) continue;
      base.bots[id] = {
        w: Number(row.w) || 0,
        l: Number(row.l) || 0,
        d: Number(row.d) || 0,
      };
    }
    base.name = name;
    base.recent = Array.isArray(data.recent)
      ? data.recent
          .filter((g) => g && (g.result === "win" || g.result === "loss" || g.result === "draw"))
          .slice(0, 8)
          .map((g) => ({ at: Number(g.at) || 0, opp: String(g.opp || ""), result: g.result }))
      : [];
    return base;
  } catch {
    return fresh();
  }
}

function write(career: Career): Career {
  localStorage.setItem(KEY, JSON.stringify(career));
  return career;
}

export function saveName(name: string): Career {
  const career = loadCareer();
  career.name = name.trim().slice(0, 18) || "You";
  return write(career);
}

export function noteSolo(level: Level, opp: string, result: SoloResult): Career {
  const career = loadCareer();
  const row = career.bots[level];
  if (result === "win") row.w += 1;
  else if (result === "loss") row.l += 1;
  else row.d += 1;
  career.recent = [{ at: Date.now(), opp, result }, ...career.recent].slice(0, 8);
  return write(career);
}

export function totals(career: Career): Tally {
  const t = { w: 0, l: 0, d: 0 };
  for (const id of [1, 2, 3, 4] as Level[]) {
    t.w += career.bots[id].w;
    t.l += career.bots[id].l;
    t.d += career.bots[id].d;
  }
  return t;
}
