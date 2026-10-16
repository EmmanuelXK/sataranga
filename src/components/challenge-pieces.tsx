import type { CType } from "@/game/challenge";

const FILL = "#f4efe4";
const INK = "#24160f";

function Base() {
  return <rect x="10" y="30" width="20" height="3.4" rx="1.2" fill={FILL} stroke={INK} strokeWidth="1.3" />;
}

export function ChessGlyph({ type }: { type: CType }) {
  return (
    <svg viewBox="0 0 40 40" className="chess-glyph" aria-hidden="true">
      {type === "P" && (
        <>
          <circle cx="20" cy="13" r="5" fill={FILL} stroke={INK} strokeWidth="1.4" />
          <path d="M14.5 29c.6-6 2.4-8.2 5.5-8.2s4.9 2.2 5.5 8.2" fill={FILL} stroke={INK} strokeWidth="1.4" />
          <Base />
        </>
      )}
      {type === "R" && (
        <>
          <path d="M11 11h4.2v3h3.2v-3h3.2v3H25v-3h4v6.2H11z" fill={FILL} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <path d="M13 17.2h14V30H13z" fill={FILL} stroke={INK} strokeWidth="1.3" />
          <Base />
        </>
      )}
      {type === "N" && (
        <>
          <path
            d="M29 30.2c-.4-1.6-2.2-6.4-4.6-9.2 1.6-1.2 2.6-3.2 1.6-5.4-1.2-2.6-4.2-3.2-6.2-1.6-1.2-2.6-4.6-3.4-6.6-.8-1.6 2.2-.6 4.6 1.2 6.2-2.4 1.6-4.8 4.6-5.6 8.2l-.6 2.6h20.8z"
            fill={FILL}
            stroke={INK}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="15.2" cy="16.2" r="1" fill={INK} />
          <Base />
        </>
      )}
      {type === "B" && (
        <>
          <path
            d="M20 6.2c1.6 2.4 1.4 4.2-.2 6 3.6 1.4 6.6 5.2 6.6 10.2H13.6c0-5 3-8.8 6.6-10.2-1.6-1.8-1.8-3.6-.2-6z"
            fill={FILL}
            stroke={INK}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="9.2" r="1.15" fill={INK} />
          <path d="M16 24.6h8" stroke={INK} strokeWidth="1.2" />
          <Base />
        </>
      )}
      {type === "Q" && (
        <>
          <circle cx="8.5" cy="13" r="1.7" fill={FILL} stroke={INK} strokeWidth="1.1" />
          <circle cx="15" cy="9.2" r="1.7" fill={FILL} stroke={INK} strokeWidth="1.1" />
          <circle cx="25" cy="9.2" r="1.7" fill={FILL} stroke={INK} strokeWidth="1.1" />
          <circle cx="31.5" cy="13" r="1.7" fill={FILL} stroke={INK} strokeWidth="1.1" />
          <path d="M8.5 14.2l4.2 11.2h14.6L31.5 14.2 25 18.4 20 10.6 15 18.4z" fill={FILL} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <Base />
        </>
      )}
      {type === "K" && (
        <>
          <path d="M20 5.2v5.2M17.4 7.8h5.2" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <path d="M9 16.4l3.6 9.2h14.8L31 16.4 24.6 20 20 12.4 15.4 20z" fill={FILL} stroke={INK} strokeWidth="1.3" strokeLinejoin="round" />
          <Base />
        </>
      )}
    </svg>
  );
}
