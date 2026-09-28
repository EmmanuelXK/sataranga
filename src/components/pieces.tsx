import type { Color, PieceType } from "@/game/engine";

const FILE: Record<PieceType, string> = {
  K: "raja",
  M: "mantri",
  G: "hasthi",
  A: "ashwa",
  R: "ratha",
  P: "padati",
};

export function PieceGlyph({
  type,
  color,
  className,
}: {
  type: PieceType;
  color: Color;
  className?: string;
}) {
  return (
    <img
      src={`/pieces/${color}-${FILE[type]}.png`}
      alt=""
      draggable={false}
      className={className ? `piece-img ${className}` : "piece-img"}
    />
  );
}
