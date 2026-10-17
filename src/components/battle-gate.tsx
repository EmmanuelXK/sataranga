import { useCallback, useEffect, useRef, useState } from "react";
import type { Launch } from "@/game/launch";

/** A fresh game may ask for the battle gate. Resumes pass gate: false. */
export type PlayLaunch = Launch & { gate?: boolean };

const PLAY_MS = 820;
const CHALLENGE_MS = 880;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Plays once per token. Token 0 stays quiet, including resumes and re-renders. */
export function useGateRun(token: number, variant: "play" | "challenge") {
  const [seen, setSeen] = useState(token);
  const [run, setRun] = useState(token > 0);
  const [quiet, setQuiet] = useState(prefersReducedMotion);
  const timer = useRef(0);

  if (token !== seen) {
    setSeen(token);
    setQuiet(prefersReducedMotion());
    setRun(token > 0);
  }

  const skip = useCallback(() => {
    window.clearTimeout(timer.current);
    setRun(false);
  }, []);

  useEffect(() => {
    if (!run) return;
    const reduced = prefersReducedMotion();
    setQuiet(reduced);
    const ms = reduced ? 200 : variant === "challenge" ? CHALLENGE_MS : PLAY_MS;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setRun(false), ms);
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      skip();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("keydown", onKey);
    };
  }, [run, token, variant, skip]);

  return { run, quiet, skip };
}

/** Hen and Richat rings from the splash, played as a short sweep. Tap skips. */
export function BattleGate({
  variant,
  quiet,
  onSkip,
}: {
  variant: "play" | "challenge";
  quiet: boolean;
  onSkip: () => void;
}) {
  return (
    <button type="button" className={quiet ? "battle-gate battle-gate-quiet" : "battle-gate"} onClick={onSkip} aria-label="Skip the battle gate">
      {!quiet && (
        <>
          <GateRings />
          <GateHen />
          {variant === "challenge" && <span className="gate-banner">CHESS vs SATARANGA</span>}
        </>
      )}
    </button>
  );
}

function GateRings() {
  const cx = 180;
  const cy = 180;
  const rings = [28, 52, 78, 108, 140, 172];
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg className="gate-rings" viewBox="0 0 360 360" aria-hidden="true">
      <g fill="none" stroke="#e6d3b4">
        {rings.map((r, index) => (
          <circle key={r} cx={cx} cy={cy} r={r} stroke={index % 2 === 0 ? "#f3e6cc" : "#c4a078"} strokeWidth={index % 2 === 0 ? 1.4 : 0.85} />
        ))}
        {ticks.map((deg) => {
          const long = deg % 30 === 0;
          const rad = (deg * Math.PI) / 180;
          const inner = long ? 156 : 164;
          const outer = 174;
          return (
            <path
              key={deg}
              d={`M${(cx + Math.cos(rad) * inner).toFixed(1)} ${(cy + Math.sin(rad) * inner).toFixed(1)} L${(cx + Math.cos(rad) * outer).toFixed(1)} ${(cy + Math.sin(rad) * outer).toFixed(1)}`}
              stroke="#f6efe2"
              strokeWidth={long ? 1.15 : 0.55}
            />
          );
        })}
        <path d={`M${cx} ${cy - 150} V${cy + 150} M${cx - 150} ${cy} H${cx + 150}`} strokeWidth="0.45" opacity="0.45" />
      </g>
    </svg>
  );
}

/** The splash junglefowl, drawn again so the splash screen itself stays untouched. */
function GateHen() {
  return (
    <svg className="gate-hen" viewBox="0 0 160 140" aria-hidden="true">
      <g>
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
        <path d="M52 112c2 10 1 16-2 18M68 114c2 10 0 16-3 18" fill="none" stroke="#c4a078" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M46 130h10M62 132h10" fill="none" stroke="#1a120c" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
