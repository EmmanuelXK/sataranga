import type { ReactNode } from "react";

/** Ink ornaments for the ancient-manuscript shell. Decorative only. */

export function WordOrnament() {
  return (
    <svg className="ms-ornament" viewBox="0 0 88 22" aria-hidden="true">
      <path d="M44 3l3.2 6.2L54 11l-6.8 1.8L44 19l-3.2-6.2L34 11l6.8-1.8z" fill="currentColor" />
      <path d="M8 11h22M58 11h22" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M16 11c2-3 4-3 6 0M66 11c2-3 4-3 6 0" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function WeaveBand() {
  return (
    <svg className="ms-weave" viewBox="0 0 390 16" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 8h390M6 2l6 12M18 2l6 12M30 2l6 12M42 2l6 12M54 2l6 12M66 2l6 12M78 2l6 12M90 2l6 12M102 2l6 12M114 2l6 12M126 2l6 12M138 2l6 12M150 2l6 12M162 2l6 12M174 2l6 12M186 2l6 12M198 2l6 12M210 2l6 12M222 2l6 12M234 2l6 12M246 2l6 12M258 2l6 12M270 2l6 12M282 2l6 12M294 2l6 12M306 2l6 12M318 2l6 12M330 2l6 12M342 2l6 12M354 2l6 12M366 2l6 12M378 2l6 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

function Ink({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export function IconTemple() {
  return (
    <Ink>
      <path d="M6 26h20M8 26V16h16v10" />
      <path d="M5 16h22L16 8z" />
      <path d="M12 26v-6h8v6M16 8V5" />
    </Ink>
  );
}

export function IconScholar() {
  return (
    <Ink>
      <circle cx="16" cy="13" r="5" />
      <path d="M8 26c1.5-5 5-7 8-7s6.5 2 8 7" />
      <path d="M11 11c1-3 9-3 10 0" />
    </Ink>
  );
}

export function IconFriends() {
  return (
    <Ink>
      <circle cx="11" cy="12" r="3.2" />
      <circle cx="21" cy="12" r="3.2" />
      <path d="M5 25c.8-4 3.2-6 6-6s5.2 2 6 6M15 25c.8-4 3.2-6 6-6s5.2 2 6 6" />
    </Ink>
  );
}

export function IconScroll() {
  return (
    <Ink>
      <path d="M9 8h12a3 3 0 0 1 3 3v12H12a3 3 0 0 1-3-3z" />
      <path d="M9 8a3 3 0 0 0-3 3v2h3M13 14h7M13 18h7" />
    </Ink>
  );
}

export function IconBust() {
  return (
    <Ink>
      <circle cx="16" cy="12" r="4.5" />
      <path d="M7 26c1.2-5 4.2-7.5 9-7.5S23.8 21 25 26" />
    </Ink>
  );
}

export function IconQuill() {
  return (
    <Ink>
      <path d="M22 6c-6 2-12 10-14 18" />
      <path d="M22 6c2 6-2 12-8 16" />
      <path d="M8 24l3 3M14 20l-2 4" />
    </Ink>
  );
}

/** Old scholar, ink on parchment. The coach on bot and lore screens. */
export function SageMark() {
  return (
    <svg className="sage-mark" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="33" fill="#ead7b8" stroke="#4a3424" strokeWidth="1.4" />
      <path d="M16 32c4-16 36-18 42 0-4-8-12-12-21-12s-17 4-21 12z" fill="none" stroke="#4a3424" strokeWidth="1.3" />
      <path d="M22 31c2 2 5 2 7 0M43 31c2 2 5 2 7 0" fill="none" stroke="#4a3424" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M33 40c2.2 2.4 5.2 2.4 7.2 0" fill="none" stroke="#4a3424" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M24 46c3 10 21 12 26 0" fill="none" stroke="#4a3424" strokeWidth="1.3" />
      <path d="M28 52c3 7 13 8 17 0" fill="none" stroke="#4a3424" strokeWidth="1.2" />
      <path d="M20 58c6 6 26 6 32 0" fill="none" stroke="#4a3424" strokeWidth="1.2" />
    </svg>
  );
}

export function SageCoach({ text }: { text: string }) {
  return (
    <div className="sage-row">
      <SageMark />
      <p className="sage-bubble">{text}</p>
    </div>
  );
}

/** Elephant, chariot, and warriors in sepia ink, with a faint astrolabe. */
export function BattleSketch() {
  return (
    <svg className="ms-sketch" viewBox="0 0 400 300" role="img" aria-label="An elephant, a chariot, and warriors">
      <g className="ms-astro" fill="none" stroke="currentColor" strokeWidth="1">
        <circle cx="78" cy="78" r="58" />
        <circle cx="78" cy="78" r="40" />
        <circle cx="78" cy="78" r="22" />
        <path d="M78 16v124M16 78h124M34 34l88 88M122 34L34 122" />
        <path d="M40 200c40-20 80-18 120 8M250 40c30 16 70 18 110-6M300 250c-40 10-90 8-130-12" opacity="0.7" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
        <path d="M46 168c2-28 22-48 48-46 18 1 32 12 40 26" />
        <path d="M86 150c-16-28-8-48 12-52 8 10 10 24 6 36" />
        <path d="M132 128c18-22 42-26 52-8 4 8-2 18-14 24" />
        <path d="M176 124c22 8 34 28 28 52-2 8-28 6-40-4" />
        <path d="M188 132c16 10 28 28 22 48" />
        <path d="M168 118c8-6 18-4 22 4" />
        <path d="M62 168c-4 28-2 48 6 62M86 176c-2 26 2 44 8 54M118 178c0 24 2 42 6 52M148 176c2 22 6 40 10 52" />
        <path d="M58 230h28M84 230h28M116 230h28M146 228h26" />
        <circle cx="248" cy="214" r="26" />
        <circle cx="248" cy="214" r="8" />
        <circle cx="312" cy="214" r="26" />
        <circle cx="312" cy="214" r="8" />
        <path d="M228 188h112l10 26H218z" />
        <path d="M236 188V146h92v42" />
        <path d="M228 146h108" />
        <path d="M270 146v-16h28v16" />
        <circle cx="282" cy="162" r="7" />
        <path d="M282 169v18M274 178h16" />
        <path d="M36 150l-8-46M28 104h10" />
        <circle cx="34" cy="158" r="5" />
        <path d="M34 163v28M28 176h12M30 191l-6 22M38 191l6 22" />
        <path d="M18 168l-6-40" />
        <circle cx="16" cy="176" r="4.5" />
        <path d="M16 180v24M12 192h8" />
        <path d="M352 156l10-48M362 108h-8" />
        <circle cx="354" cy="164" r="5" />
        <path d="M354 169v26M348 182h12M350 195l-6 20M358 195l7 20" />
        <path d="M378 172l8-36" />
        <circle cx="380" cy="180" r="4.5" />
        <path d="M380 184v22" />
      </g>
    </svg>
  );
}
