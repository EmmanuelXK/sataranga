import type { CType } from "@/game/challenge";

/** Original SATARANGA Staunton set. The chess side of Challenge only. */
const FILE: Partial<Record<CType, string>> = {
  K: "wK",
  Q: "wQ",
  R: "wR",
  B: "wB",
  N: "wN",
  P: "wP",
};

export function ChessGlyph({ type }: { type: CType }) {
  const file = FILE[type];
  if (!file) return null;
  return <img src={`/pieces/sataranga-staunton/${file}.svg`} alt="" className="chess-glyph" draggable={false} />;
}
