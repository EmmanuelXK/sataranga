import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { Bot, Swords, Users } from "lucide-react";
import { ENGINES, PIECE_META, type Color, type Level, type PieceType } from "@/game/engine";
import { PieceGlyph } from "@/components/pieces";
import { roomCode, type Launch } from "@/game/launch";
import { loadCareer, saveName, totals, type Career } from "@/game/career";

const SAVE_KEY = "chaturanga-pvp-v1";
const ARMY: PieceType[] = ["K", "M", "G", "A", "R", "P"];

export function Lobby({ onPlay }: { onPlay: (launch: Launch) => void }) {
  const [level, setLevel] = useState<Level>(2);
  const [human, setHuman] = useState<Color>("w");
  const [career, setCareer] = useState<Career>(() => loadCareer());
  const [draft, setDraft] = useState(() => loadCareer().name);
  const [join, setJoin] = useState("");
  const [canResume, setCanResume] = useState(false);
  const [focus, setFocus] = useState<PieceType>("G");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { v?: number; moves?: unknown[] };
      setCanResume(data.v === 1 && Array.isArray(data.moves) && data.moves.length > 0);
    } catch {
      setCanResume(false);
    }
  }, []);

  const name = draft.trim() || career.name;
  const score = totals(career);
  const piece = PIECE_META[focus];

  function sit(lv: Level = level) {
    onPlay({ kind: "solo", human, level: lv });
  }

  return (
    <main className="shell lobby">
      <header className="top">
        <div>
          <h1 className="wordmark">SATARANGA</h1>
          <p className="sub">Ancient war chess. Raja, elephant, horse, chariot.</p>
        </div>
        <div className="lobby-mark" aria-hidden="true">
          <PieceGlyph type="K" color="w" />
        </div>
      </header>

      <section className="identity">
        <label className="name-field">
          Name on the board
          <input
            value={draft}
            maxLength={18}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const next = saveName(draft);
              setCareer(next);
              setDraft(next.name);
            }}
          />
        </label>
        <div className="record-block">
          <p className="record">
            {score.w}–{score.l}–{score.d}
          </p>
          <p className="sub">Wins, losses, draws vs bots</p>
        </div>
      </section>

      <section className="lobby-hero">
        <div>
          <p className="eyebrow">Play now</p>
          <h2>Sit down against {ENGINES[level].name}</h2>
          <p className="lede">
            {human === "w" ? "You have the first move." : "The engine moves first."} {ENGINES[level].blurb}
          </p>
        </div>
        <button type="button" className="play-main" onClick={() => sit()}>
          <Swords strokeWidth={1.75} />
          Play now
        </button>
      </section>

      <div className="army" role="listbox" aria-label="The six pieces">
        {ARMY.map((type) => (
          <button
            key={type}
            type="button"
            role="option"
            aria-selected={focus === type}
            className={clsx(focus === type && "on")}
            onClick={() => setFocus(type)}
          >
            <span className="army-glyph">
              <PieceGlyph type={type} color="w" />
            </span>
            {PIECE_META[type].name}
          </button>
        ))}
      </div>
      <p className="army-note">
        <strong>{piece.name}</strong>
        <span> {piece.aka}. </span>
        {piece.blurb}
      </p>

      <div className="lobby-grid">
        <section className="card">
          <header className="card-h">
            <Bot strokeWidth={1.75} />
            <h2>Bots</h2>
          </header>
          <p className="card-copy">
            Four searches of this ruleset, from a patient learner to a slow stubborn Raja. Stockfish plays a different
            game, so it is not here.
          </p>
          <div className="side-pick" role="radiogroup" aria-label="Your color">
            <button type="button" role="radio" aria-checked={human === "w"} className={clsx(human === "w" && "on")} onClick={() => setHuman("w")}>
              White
            </button>
            <button type="button" role="radio" aria-checked={human === "b"} className={clsx(human === "b" && "on")} onClick={() => setHuman("b")}>
              Black
            </button>
          </div>
          <div className="engine-list" role="radiogroup" aria-label="Engine">
            {(Object.keys(ENGINES) as unknown as Level[]).map((id) => {
              const lv = Number(id) as Level;
              const row = career.bots[lv];
              return (
                <div key={id} className={clsx("bot-row", level === lv && "on")}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={level === lv}
                    className={clsx("engine", level === lv && "on")}
                    onClick={() => setLevel(lv)}
                  >
                    <strong className="engine-top">
                      {ENGINES[lv].name}
                      <span className="ticks" aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => (
                          <i key={n} className={n <= lv ? "on" : undefined} />
                        ))}
                      </span>
                    </strong>
                    <span>
                      You {row.w}–{row.l}–{row.d}. {ENGINES[lv].blurb}
                    </span>
                  </button>
                  <button type="button" className="sit" onClick={() => sit(lv)}>
                    Sit
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card">
          <header className="card-h">
            <Users strokeWidth={1.75} />
            <h2>Live table</h2>
          </header>
          <p className="card-copy">
            Open a table and send the code to one friend. The board starts when they join. Direct, unrated, no referee.
          </p>
          <button
            type="button"
            className="play-second"
            onClick={() => onPlay({ kind: "live", room: roomCode(), name: name.trim() || "You" })}
          >
            Open a table
          </button>
          <form
            className="join-row"
            onSubmit={(e) => {
              e.preventDefault();
              const room = join.trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
              if (room.length < 4) return;
              onPlay({ kind: "live", room, name: name.trim() || "You" });
            }}
          >
            <input
              value={join}
              placeholder="Enter a code"
              aria-label="Table code"
              maxLength={12}
              onChange={(e) => setJoin(e.target.value)}
            />
            <button type="submit">Join</button>
          </form>
        </section>

        <section className="card">
          <header className="card-h">
            <Swords strokeWidth={1.75} />
            <h2>Same device</h2>
          </header>
          <p className="card-copy">Pass the phone. The board turns with the side to move.</p>
          <button type="button" className="play-second" onClick={() => onPlay({ kind: "pvp" })}>
            Pass & play
          </button>
          {canResume ? (
            <button type="button" className="play-quiet" onClick={() => onPlay({ kind: "resume" })}>
              Continue saved game
            </button>
          ) : null}
          {career.recent.length > 0 ? (
            <ul className="recent">
              {career.recent.slice(0, 3).map((g) => (
                <li key={g.at}>
                  <span>{g.result === "win" ? "Won" : g.result === "loss" ? "Lost" : "Drew"}</span>
                  <span>vs {g.opp}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  );
}
