import { memo, useState } from "react";
import type { Color, PieceType } from "@/game/engine";

const FILE: Record<PieceType, string> = {
  K: "raja",
  M: "mantri",
  G: "hasthi",
  A: "ashwa",
  R: "ratha",
  P: "padati",
};

const rawModules = import.meta.glob("../../public/pieces/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const RAW: Record<string, string> = {};
for (const [path, svg] of Object.entries(rawModules)) {
  const name = path.split("/").pop()?.replace(/\.svg$/, "");
  if (name && /^[wb]-(raja|mantri|hasthi|ashwa|ratha|padati)$/.test(name)) RAW[name] = svg;
}

const DATA: Record<string, string> = {};
for (const [name, svg] of Object.entries(RAW)) {
  DATA[name] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const decoded = new Set<string>();

/** Decode each piece once. Later boards reuse that image instead of fetching again. */
function warmPieces() {
  if (typeof window === "undefined" || decoded.size > 0) return;
  for (const [name, uri] of Object.entries(DATA)) {
    const img = new Image();
    img.decoding = "async";
    img.src = uri;
    decoded.add(name);
    void img.decode?.().catch(() => undefined);
  }
}

warmPieces();

export const PieceGlyph = memo(function PieceGlyph({
  type,
  color,
  className,
}: {
  type: PieceType;
  color: Color;
  className?: string;
}) {
  const name = `${color}-${FILE[type]}`;
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  if (step >= 2) {
    const inline = [className, "piece-img", "piece-inline"].filter(Boolean).join(" ");
    return <span className={inline} aria-hidden="true" dangerouslySetInnerHTML={{ __html: RAW[name] ?? "" }} />;
  }

  const cls = [className, "piece-img", ready ? "" : "piece-hold"].filter(Boolean).join(" ");

  const src = step === 0 ? DATA[name] : `/pieces/256/${name}.png?v=16`;
  return (
    <img
      key={name}
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      loading="eager"
      className={cls}
      ref={(img) => {
        if (img && img.complete && img.naturalWidth > 0) setReady(true);
      }}
      onLoad={() => setReady(true)}
      onError={() => {
        setReady(false);
        setStep((n) => n + 1);
      }}
    />
  );
});
