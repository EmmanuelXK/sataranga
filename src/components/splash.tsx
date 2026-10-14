import { useEffect, useRef } from "react";

const WORD = "SATARANGA";

/** Short ink junglefowl over a quiet ring-city blueprint. Tap anywhere to skip. */
export function Splash({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const timer = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    timer.current = window.setTimeout(() => done.current(), reduced ? 800 : 2000);
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
      <Blueprint />
      <span className="splash-vignette" aria-hidden="true" />
      <span className="splash-stage">
        <span className="splash-hero">
          <Junglefowl />
          <ChessTile />
        </span>
        <span className="splash-name" aria-hidden="true">
          {WORD.split("").map((letter, index) => (
            <span key={letter + index} style={{ animationDelay: `${1.02 + index * 0.04}s` }}>
              {letter}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

function Blueprint() {
  const cx = 180;
  const cy = 300;
  const rings = [26, 46, 68, 92, 118, 146, 176];
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg className="splash-map" viewBox="0 0 360 640" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g className="splash-rings" fill="none" stroke="#e6d3b4">
        <circle cx={cx} cy={cy} r="18" fill="#0c0806" stroke="none" opacity="0.55" />
        <path d={`M${cx} ${cy - 168} V${cy + 168} M${cx - 168} ${cy} H${cx + 168}`} strokeWidth="0.4" opacity="0.28" />
        {rings.map((r, index) => (
          <circle
            key={r}
            className="splash-ring"
            cx={cx}
            cy={cy}
            r={r}
            stroke={index % 2 === 0 ? "#f3e6cc" : "#c4a078"}
            strokeWidth={index % 2 === 0 ? 1.35 : 0.8}
            style={{ animationDelay: `${0.04 + index * 0.08}s` }}
          />
        ))}
        {ticks.map((deg) => {
          const long = deg % 30 === 0;
          const inner = long ? 164 : 170;
          const [x1, y1] = onRing(cx, cy, inner, inner, deg);
          const [x2, y2] = onRing(cx, cy, 178, 178, deg);
          return <path key={deg} className="splash-mark" d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} strokeWidth={long ? 1.05 : 0.55} style={{ animationDelay: "0.52s" }} />;
        })}
        {[46, 92, 146].map((r, index) =>
          [32, 148, 212, 328].map((deg) => {
            const [x1, y1] = onRing(cx, cy, r - 6, r - 6, deg);
            const [x2, y2] = onRing(cx, cy, r + 5, r + 5, deg);
            return <path key={`${r}-${deg}`} className="splash-mark" d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`} strokeWidth="0.95" style={{ animationDelay: `${0.16 + index * 0.1}s` }} />;
          }),
        )}
        <Compass x={cx} y={cy - 196} />
      </g>
    </svg>
  );
}

function ChessTile() {
  const bl = [6, 14];
  const du = [16.2, -1.1];
  const dv = [2.4, 5.6];
  const at = (file: number, rank: number) => [bl[0] + file * du[0] + rank * dv[0], bl[1] + file * du[1] + rank * dv[1]];
  const cells = [];
  for (let rank = 0; rank < 4; rank++) {
    for (let file = 0; file < 4; file++) {
      const [x0, y0] = at(file, rank);
      const [x1, y1] = at(file + 1, rank);
      const [x2, y2] = at(file + 1, rank + 1);
      const [x3, y3] = at(file, rank + 1);
      cells.push(
        <path
          key={`${rank}-${file}`}
          d={`M${x0} ${y0} L${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z`}
          fill={(rank + file) % 2 === 0 ? "#f3e6cc" : "#6b4630"}
        />,
      );
    }
  }
  const [flX, flY] = at(0, 4);
  const [frX, frY] = at(4, 4);
  const [brX, brY] = at(4, 0);
  const drop = 8;
  return (
    <svg className="splash-tile" viewBox="0 0 92 62" aria-hidden="true">
      <ellipse cx="46" cy="56" rx="34" ry="4.5" fill="#000" opacity="0.4" />
      <path d={`M${flX} ${flY} L${frX} ${frY} L${frX} ${frY + drop} L${flX} ${flY + drop} Z`} fill="#3a291c" />
      <path d={`M${brX} ${brY} L${frX} ${frY} L${frX} ${frY + drop} L${brX} ${brY + drop} Z`} fill="#241810" />
      <g>{cells}</g>
      <path d={`M${at(0, 0).join(" ")} L${at(4, 0).join(" ")} L${at(4, 4).join(" ")} L${at(0, 4).join(" ")} Z`} fill="none" stroke="#c4a078" strokeWidth="1.15" />
    </svg>
  );
}

function onRing(cx: number, cy: number, rx: number, ry: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
}

function Compass({ x, y, small }: { x: number; y: number; small?: boolean }) {
  const s = small ? 0.62 : 1;
  return (
    <g className="splash-mark" transform={`translate(${x} ${y}) scale(${s})`} strokeWidth="1.15" style={{ animationDelay: small ? "0.7s" : "0.35s" }}>
      <circle r="11" />
      <path d="M0 -16 L2.4 0 L0 16 L-2.4 0 Z M-16 0 L0 2.4 L16 0 L0 -2.4 Z" />
      <circle r="1.6" fill="#e6d3b4" stroke="none" />
    </g>
  );
}

function Junglefowl() {
  return (
    <svg className="splash-bird" viewBox="0 0 160 140" aria-hidden="true">
      <ellipse className="splash-shadow" cx="78" cy="126" rx="36" ry="6" />
      <g className="splash-body">
        <g className="splash-tail">
          <path d="M118 78c8 2 16 10 14 18-8 2-18-2-24-8" fill="#3e2e24" stroke="#1a120c" strokeWidth="2" />
          <path d="M124 70c10-2 22 4 24 12-8 6-18 4-24-2" fill="#2a1e16" stroke="#1a120c" strokeWidth="2" />
          <path d="M128 62c12-6 26-2 30 8-10 8-22 6-30-2" fill="#1a120c" stroke="#1a120c" strokeWidth="2" />
        </g>
        <path
          d="M46 78c-8 10-6 28 8 36 18 10 46 8 62-4 10-8 12-22 4-32-10-14-28-24-48-22-12 2-20 10-26 22z"
          fill="#3e2e24"
          stroke="#1a120c"
          strokeWidth="2.2"
        />
        <g className="splash-wing">
          <path d="M58 74c8-16 28-22 44-14 4 2 6 6 4 8-12-2-28 2-38 12-4-2-8-4-10-6z" fill="#e6d3b4" stroke="#1a120c" strokeWidth="1.6" />
        </g>
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
        <path className="splash-spark" d="M24 48 l1.3 3.4 3.4 1.3 -3.4 1.3 -1.3 3.4 -1.3 -3.4 -3.4 -1.3 3.4 -1.3 z" />
        <path d="M52 112c2 10 1 16-2 18M68 114c2 10 0 16-3 18" fill="none" stroke="#c4a078" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M46 130h10M62 132h10" fill="none" stroke="#1a120c" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
