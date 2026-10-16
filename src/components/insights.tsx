import { useEffect, useState } from "react";
import {
  analyze,
  insightStamp,
  loadInsights,
  readInsightCache,
  writeInsightCache,
  type InsightReport,
  type Phase,
} from "@/game/insights";

const PHASES: { id: Phase; label: string }[] = [
  { id: "opening", label: "Opening" },
  { id: "middlegame", label: "Middlegame" },
  { id: "endgame", label: "Endgame" },
];

let memory: { stamp: string; report: InsightReport } | null = null;

function seconds(ms: number | null): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

function rate(wins: number, games: number): string {
  if (!games) return "—";
  return `${Math.round((wins / games) * 100)}%`;
}

export function InsightsPanel() {
  const [report, setReport] = useState<InsightReport | null>(null);
  const [which, setWhich] = useState(0);

  useEffect(() => {
    let cancel = false;
    const games = loadInsights();
    const stamp = insightStamp(games);
    const cached = memory?.stamp === stamp ? memory.report : readInsightCache(stamp);
    if (cached) {
      memory = { stamp, report: cached };
      setReport(cached);
      setWhich(Math.max(0, cached.strategic.series.length - 1));
      return;
    }
    const run = () => {
      if (cancel) return;
      const next = analyze(games);
      memory = { stamp, report: next };
      writeInsightCache(stamp, next);
      setReport(next);
      setWhich(Math.max(0, next.strategic.series.length - 1));
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 500 });
      return () => {
        cancel = true;
        window.cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 30);
    return () => {
      cancel = true;
      window.clearTimeout(id);
    };
  }, []);

  return (
    <section className="hall-panel insights-page" aria-labelledby="insights-title">
      <h2 id="insights-title">Insights</h2>
      {!report && (
        <article className="hall-card">
          <p>Reading the games on this phone.</p>
        </article>
      )}
      {report && !report.ready && (
        <article className="hall-card">
          <p>Finish five bot games and this page will read your own moves and the time you took.</p>
          <p className="insight-wait">
            {report.kept} of 5 so far.
          </p>
        </article>
      )}
      {report && report.ready && (
        <>
          <Strategic report={report} which={which} setWhich={setWhich} />
          <TimeCard report={report} />
          <Positional report={report} />
          <Psychology report={report} />
          <Choices report={report} />
        </>
      )}
    </section>
  );
}

function Score({ label, score }: { label: string; score: number }) {
  return (
    <header className="insight-head">
      <h3>{label}</h3>
      <p className="insight-score">
        <b>{score}</b>
        <span> / 100</span>
      </p>
    </header>
  );
}

function Strategic({
  report,
  which,
  setWhich,
}: {
  report: InsightReport;
  which: number;
  setWhich: (n: number) => void;
}) {
  const block = report.strategic;
  const series = block.series;
  const index = Math.min(which, Math.max(0, series.length - 1));
  const current = series[index];
  return (
    <article className="hall-card insight-block">
      <Score label="Strategic" score={block.score} />
      <p className="insight-tip">{block.tip}</p>
      {current && (
        <>
          <div className="insight-switch">
            <button type="button" onClick={() => setWhich(Math.max(0, index - 1))} disabled={index === 0}>
              Earlier
            </button>
            <span>
              {current.label} of {series.length}
            </span>
            <button type="button" onClick={() => setWhich(Math.min(series.length - 1, index + 1))} disabled={index === series.length - 1}>
              Later
            </button>
          </div>
          <LineChart evals={current.evals} />
        </>
      )}
      <table className="insight-table">
        <caption>Winning positions and games actually won</caption>
        <tbody>
          <tr>
            <th scope="row">Winning positions</th>
            <td>{block.winningPositions}</td>
          </tr>
          <tr>
            <th scope="row">Games won from there</th>
            <td>{block.wonFromThere}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function TimeCard({ report }: { report: InsightReport }) {
  const block = report.time;
  return (
    <article className="hall-card insight-block">
      <Score label="Time" score={block.score} />
      <p className="insight-tip">{block.tip}</p>
      <BarChart bars={block.bars} />
      <p className="insight-kicker">Instant moves in sharp positions</p>
      <div className="insight-strip" role="img" aria-label={`${block.flags} instant moves where the evaluation swung hard`}>
        {block.strip.length === 0 && <span className="insight-muted">No timed moves yet.</span>}
        {block.strip.map((flag, index) => (
          <i key={index} className={flag ? "hot" : ""} />
        ))}
      </div>
    </article>
  );
}

function Positional({ report }: { report: InsightReport }) {
  const block = report.positional;
  const peak = Math.max(1, ...block.heat);
  return (
    <article className="hall-card insight-block">
      <Score label="Positional" score={block.score} />
      <p className="insight-tip">{block.tip}</p>
      <div className="insight-grid" role="img" aria-label="Where your pieces stood">
        {Array.from({ length: 8 }, (_, row) => 7 - row).map((rank) =>
          Array.from({ length: 8 }, (_, file) => {
            const sq = rank * 8 + file;
            const amount = block.heat[sq] / peak;
            return <i key={sq} style={{ opacity: amount === 0 ? 0.12 : 0.2 + amount * 0.8 }} />;
          }),
        )}
      </div>
      <table className="insight-table">
        <caption>Pieces left on the rim</caption>
        <thead>
          <tr>
            <th scope="col">Piece</th>
            <th scope="col">Square</th>
            <th scope="col">Moves</th>
          </tr>
        </thead>
        <tbody>
          {block.bad.length === 0 && (
            <tr>
              <td colSpan={3}>None sat on the rim for long.</td>
            </tr>
          )}
          {block.bad.map((row) => (
            <tr key={`${row.piece}-${row.square}`}>
              <td>{row.piece}</td>
              <td>{row.square}</td>
              <td>{row.moves}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function Psychology({ report }: { report: InsightReport }) {
  const block = report.psychology;
  return (
    <article className="hall-card insight-block">
      <Score label="Psychology" score={block.score} />
      <p className="insight-tip">{block.tip}</p>
      <table className="insight-table">
        <caption>Accuracy after a result, and games saved from worse positions</caption>
        <tbody>
          <tr>
            <th scope="row">After a win</th>
            <td>{block.afterWin == null ? "—" : `${block.afterWin}%`}</td>
          </tr>
          <tr>
            <th scope="row">After a loss</th>
            <td>{block.afterLoss == null ? "—" : `${block.afterLoss}%`}</td>
          </tr>
          <tr>
            <th scope="row">Saved games</th>
            <td>{block.saved}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function Choices({ report }: { report: InsightReport }) {
  const block = report.choices;
  return (
    <article className="hall-card insight-block">
      <Score label="Choices" score={block.score} />
      <p className="insight-tip">{block.tip}</p>
      <Donut aggressive={block.aggressive} quiet={block.quiet} defensive={block.defensive} />
      <ul className="insight-legend">
        <li>
          <i className="agg" /> Attack {block.aggressive}
        </li>
        <li>
          <i className="quiet" /> Quiet {block.quiet}
        </li>
        <li>
          <i className="def" /> Defence {block.defensive}
        </li>
      </ul>
      <table className="insight-table">
        <caption>Colour chosen, and how often that choice won</caption>
        <thead>
          <tr>
            <th scope="col">Colour</th>
            <th scope="col">Games</th>
            <th scope="col">Won</th>
          </tr>
        </thead>
        <tbody>
          {block.colours.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td>{row.games}</td>
              <td>{rate(row.wins, row.games)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}

function LineChart({ evals }: { evals: number[] }) {
  const width = 300;
  const height = 120;
  const pad = 10;
  const min = Math.min(-80, ...evals);
  const max = Math.max(80, ...evals);
  const span = max - min || 1;
  const x = (index: number) => pad + (index / Math.max(1, evals.length - 1)) * (width - pad * 2);
  const y = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const path = evals.map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`).join(" ");
  const zero = y(0);
  return (
    <svg className="insight-line" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Your evaluation across the game">
      <line x1={pad} x2={width - pad} y1={zero} y2={zero} />
      <path d={path} />
    </svg>
  );
}

function BarChart({ bars }: { bars: InsightReport["time"]["bars"] }) {
  const values = PHASES.map((phase) => bars[phase.id] ?? 0);
  const peak = Math.max(1, ...values);
  return (
    <div className="insight-bars" role="img" aria-label="Average think time by phase of the game">
      {PHASES.map((phase) => {
        const value = bars[phase.id];
        const height = value == null ? 8 : Math.max(8, Math.round((value / peak) * 88));
        return (
          <div key={phase.id}>
            <b style={{ height }} />
            <span>{seconds(value)}</span>
            <em>{phase.label}</em>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ aggressive, quiet, defensive }: { aggressive: number; quiet: number; defensive: number }) {
  const total = aggressive + quiet + defensive || 1;
  const radius = 36;
  const length = 2 * Math.PI * radius;
  const parts = [
    { n: aggressive, color: "#5c2432" },
    { n: quiet, color: "#c4a078" },
    { n: defensive, color: "#3f6b4f" },
  ];
  let offset = 0;
  return (
    <svg className="insight-donut" viewBox="0 0 100 100" role="img" aria-label="Attack, quiet, and defensive moves">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e7d7bc" strokeWidth="12" />
      {parts.map((part) => {
        const dash = (part.n / total) * length;
        const circle = (
          <circle
            key={part.color}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={part.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${length - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += dash;
        return circle;
      })}
    </svg>
  );
}
