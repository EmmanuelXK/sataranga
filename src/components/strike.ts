import type { Color, PieceType } from "@/game/engine";

export type Strike = {
  from: number;
  to: number;
  color: Color;
  type: PieceType;
  captured: PieceType | null;
  started: number;
};

export function fightMs(type: PieceType) {
  if (type === "R") return 2100;
  if (type === "G" || type === "A") return 1760;
  return 820;
}
