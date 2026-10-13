import { useEffect, useRef } from "react";

/** Short ink junglefowl. Tap anywhere to skip. Reduced motion holds a still bird. */
export function Splash({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const timer = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => done.current(), reduced ? 700 : 1750);
    return () => window.clearTimeout(timer.current);
  }, []);

  return (
    <button
      type="button"
      className="splash"
      aria-label="Skip the introduction"
      onClick={() => {
        window.clearTimeout(timer.current);
        done.current();
      }}
    >
      <span className="splash-stage">
        <Junglefowl />
        <span className="splash-name">SATARANGA</span>
      </span>
    </button>
  );
}

function Junglefowl() {
  return (
    <svg className="splash-bird" viewBox="0 0 160 140" aria-hidden="true">
      <ellipse className="splash-shadow" cx="78" cy="126" rx="36" ry="6" />
      <g className="splash-body">
        <path d="M118 78c8 2 16 10 14 18-8 2-18-2-24-8" fill="#3e2e24" stroke="#1a120c" strokeWidth="2" />
        <path d="M124 70c10-2 22 4 24 12-8 6-18 4-24-2" fill="#2a1e16" stroke="#1a120c" strokeWidth="2" />
        <path d="M128 62c12-6 26-2 30 8-10 8-22 6-30-2" fill="#1a120c" stroke="#1a120c" strokeWidth="2" />
        <path
          d="M46 78c-8 10-6 28 8 36 18 10 46 8 62-4 10-8 12-22 4-32-10-14-28-24-48-22-12 2-20 10-26 22z"
          fill="#3e2e24"
          stroke="#1a120c"
          strokeWidth="2.2"
        />
        <path d="M58 74c8-16 28-22 44-14 4 2 6 6 4 8-12-2-28 2-38 12-4-2-8-4-10-6z" fill="#e6d3b4" stroke="#1a120c" strokeWidth="1.6" />
        <path d="M70 86c10 4 22 2 30-6" fill="none" stroke="#c4a078" strokeWidth="2" strokeLinecap="round" />
        <path d="M64 96c14 6 30 4 40-8" fill="none" stroke="#c4a078" strokeWidth="2" strokeLinecap="round" />
        <path d="M38 70c2-18 16-30 28-28 2 8-2 16-8 22-8 6-16 8-20 6z" fill="#6a5342" stroke="#1a120c" strokeWidth="2" />
        <path d="M34 48c2-8 8-12 10-8 0 6-4 10-8 12-2-1-2-2-2-4z" fill="#8d4034" stroke="#1a120c" strokeWidth="1.6" />
        <path d="M40 42c2-7 7-10 8-6 0 5-3 8-6 9-1-1-2-2-2-3z" fill="#8d4034" stroke="#1a120c" strokeWidth="1.6" />
        <path d="M46 38c2-6 6-8 7-4 0 4-2 7-5 8-1-1-2-2-2-4z" fill="#8d4034" stroke="#1a120c" strokeWidth="1.6" />
        <path d="M30 62c-10 2-16 8-14 12 6 1 12-2 16-6 1-2 0-4-2-6z" fill="#c4a078" stroke="#1a120c" strokeWidth="1.8" />
        <path d="M36 74c-4 4-4 8-1 10" fill="none" stroke="#8d4034" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="64" r="5.2" fill="#f6efe2" stroke="#1a120c" strokeWidth="1.6" />
        <circle cx="41.2" cy="64.2" r="2.2" fill="#1a120c" />
        <path className="splash-lid" d="M33.6 62.4c1.2-5.2 11.6-5.2 12.8 0v3.2c-1.4 3.6-11.4 3.6-12.8 0z" fill="#3e2e24" stroke="#1a120c" strokeWidth="1.3" />
        <path d="M52 112c2 10 1 16-2 18M68 114c2 10 0 16-3 18" fill="none" stroke="#c4a078" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M46 130h10M62 132h10" fill="none" stroke="#1a120c" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
