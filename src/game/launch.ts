import type { Color, Level } from "@/game/engine";

export type Pace = "hare" | "tortoise" | "army" | "pro";

export const PACE_MS: Record<Pace, number> = {
  hare: 3 * 60 * 1000,
  tortoise: 5 * 60 * 1000,
  army: 8 * 60 * 1000,
  pro: 10 * 60 * 1000,
};

/** Same base time on both sides. Increment is added after a move. */
export type Clocks = { w: number; b: number };

export type TimeControl = "blitz" | "rapid";

export const TIME_CONTROL: Record<TimeControl, { ms: number; inc: number; label: string; name: string }> = {
  blitz: { ms: 3 * 60 * 1000, inc: 2 * 1000, label: "3+2", name: "Blitz" },
  rapid: { ms: 5 * 60 * 1000, inc: 10 * 1000, label: "5+10", name: "Rapid" },
};

export function pairClocks(time: TimeControl): Clocks {
  const ms = TIME_CONTROL[time].ms;
  return { w: ms, b: ms };
}

export const MODE_CLOCKS = {
  ashta: { w: 3 * 60 * 1000, b: 5 * 60 * 1000 },
  sena: { w: 5 * 60 * 1000, b: 8 * 60 * 1000 },
  pro: { w: 10 * 60 * 1000, b: 15 * 60 * 1000 },
} as const;

export type Launch =
  | { kind: "resume" }
  | { kind: "pvp"; pace?: Pace; clocks?: Clocks; increment?: number }
  | { kind: "solo"; human: Color; level: Level; pace?: Pace; clocks?: Clocks; increment?: number; rated?: boolean; head?: number; strict?: boolean }
  | { kind: "chaturaja"; dice: boolean; hands: "bots" | "table" }
  | { kind: "live"; room: string; name: string; pace?: Pace; clocks?: Clocks; increment?: number };

export function roomCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}
