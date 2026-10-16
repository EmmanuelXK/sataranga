import type { CType } from "@/game/challenge";

/** White pieces from the Lichess cburnett set. See public/pieces/cburnett/CREDITS.md. */
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
  return <img src={`/pieces/cburnett/${file}.svg`} alt="" className="chess-glyph" draggable={false} />;
}
