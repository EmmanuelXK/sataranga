import { useState, type CSSProperties } from "react";
import { ChevronLeft, Swords } from "lucide-react";
import { boardTheme, readBoard } from "@/game/boards";
import { ENGINES, fileOf, startPosition, type Color, type Level, type PieceType } from "@/game/engine";
import { pairClocks, TIME_CONTROL, type Launch, type TimeControl } from "@/game/launch";
import { loadProfile } from "@/game/profile";
import { PieceGlyph } from "@/components/pieces";

const SIDE = "yuddha-side-v1";

/** Horse and elephant art faces right. The a-side pair is mirrored so the wings face outward. */
function facesOut(type: PieceType, sq: number) {
  if (type !== "A" && type !== "G") return false;
  return fileOf(sq) < 4;
}

export function Prep({
  game,
  onPlay,
  onLeave,
}: {
  game: "ashta" | "pro" | "sena";
  onPlay: (launch: Launch) => void;
  onLeave: () => void;
}) {
  const [time, setTime] = useState<TimeControl>("blitz");
  const [seat, setSeat] = useState<"rated" | "casual" | "war">("rated");
  const [dice, setDice] = useState(true);
  const [hands, setHands] = useState<"bots" | "table">("bots");
  const profile = loadProfile();
  const title = game === "sena" ? "SENAA" : game === "pro" ? "MAHA YUDDHA" : "SATARANGA";
  const tc = TIME_CONTROL[time];

  function start() {
    if (game === "sena") {
      onPlay({ kind: "chaturaja", dice, hands });
      return;
    }
    if (seat === "war") {
      onPlay({ kind: "pvp", clocks: pairClocks(time), increment: tc.inc });
      return;
    }
    const stored = typeof localStorage !== "undefined" && localStorage.getItem(SIDE) === "b" ? "b" : "w";
    const human: Color = stored;
    if (typeof localStorage !== "undefined") localStorage.setItem(SIDE, human === "w" ? "b" : "w");
    const level: Level =
      game === "pro" ? 4 : profile.rating < 380 ? 1 : profile.rating < 520 ? 2 : profile.rating < 640 ? 3 : 4;
    onPlay({
      kind: "solo",
      human,
      level,
      clocks: pairClocks(time),
      increment: tc.inc,
      rated: seat === "rated",
      strict: game === "pro",
    });
  }

  const note =
    game === "sena"
      ? hands === "bots"
        ? "You play Red. The other three are on this phone."
        : "Four hands on this phone. The board turns with the turn."
      : seat === "war"
        ? "Same phone. The board flips after every move."
        : seat === "rated"
          ? `${ENGINES[game === "pro" ? 4 : profile.rating < 380 ? 1 : profile.rating < 520 ? 2 : profile.rating < 640 ? 3 : 4].name} plays the other side. Win +18. Loss −12.`
          : "Casual games are not rated.";

  return (
    <main className="shell play">
      <header className="top">
        <div className="top-lead">
          <button type="button" className="icon-btn" onClick={onLeave}>
            <ChevronLeft strokeWidth={1.75} />
            <span>Lobby</span>
          </button>
          <div>
            <h1 className="wordmark">{title}</h1>
            <p className="sub">{game === "sena" ? "Chathuraja" : game === "pro" ? "Raja engine" : "SATARANGA"}</p>
          </div>
        </div>
      </header>
      {game === "sena" ? (
        <div className="prep-mark">
          <img src="/art/sena.png" alt="" />
        </div>
      ) : (
        <div className="prep-stage">
          <QuietBoard />
        </div>
      )}
      <section className="prep-dock">
        <h2>{game === "sena" ? "How this game starts" : "Time and seat"}</h2>
        <p>{game === "pro" ? "No takebacks." : "Set this game, then the board is live."}</p>
        {game === "sena" ? (
          <>
            <label className="prep-label">The die</label>
            <div className="segment" role="radiogroup" aria-label="The die">
              <button type="button" role="radio" aria-checked={dice} onClick={() => setDice(true)}>
                Dice on
              </button>
              <button type="button" role="radio" aria-checked={!dice} onClick={() => setDice(false)}>
                Free move
              </button>
            </div>
            <label className="prep-label">Hands</label>
            <div className="segment" role="radiogroup" aria-label="Hands">
              <button type="button" role="radio" aria-checked={hands === "bots"} onClick={() => setHands("bots")}>
                You vs three
              </button>
              <button type="button" role="radio" aria-checked={hands === "table"} onClick={() => setHands("table")}>
                Four hands
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="prep-label">Time</label>
            <div className="segment" role="radiogroup" aria-label="Time">
              <button type="button" role="radio" aria-checked={time === "blitz"} onClick={() => setTime("blitz")}>
                Blitz 3+2
              </button>
              <button type="button" role="radio" aria-checked={time === "rapid"} onClick={() => setTime("rapid")}>
                Rapid 5+10
              </button>
            </div>
            <label className="prep-label">Seat</label>
            <div className="segment" role="radiogroup" aria-label="Seat">
              <button type="button" role="radio" aria-checked={seat === "rated"} onClick={() => setSeat("rated")}>
                Rated
              </button>
              <button type="button" role="radio" aria-checked={seat === "casual"} onClick={() => setSeat("casual")}>
                Casual
              </button>
              <button type="button" role="radio" aria-checked={seat === "war"} onClick={() => setSeat("war")}>
                War
              </button>
            </div>
          </>
        )}
        <p className="prep-note">{note}</p>
        <button type="button" className="play-main" onClick={start}>
          <Swords strokeWidth={2.25} />
          {game === "sena" ? "Enter SENAA" : game === "pro" ? "Enter MAHA YUDDHA" : "Start"}
        </button>
      </section>
    </main>
  );
}

function QuietBoard() {
  const theme = boardTheme(readBoard());
  const board = startPosition().board;
  const ranks = [7, 6, 5, 4, 3, 2, 1, 0];
  const files = [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <div
      className="frame"
      aria-hidden
    >
      <div className="board" style={{ "--sq-light": theme.light, "--sq-dark": theme.dark } as CSSProperties}>
        {ranks.flatMap((rank) =>
          files.map((file) => {
            const sq = rank * 8 + file;
            const piece = board[sq];
            const dark = (file + rank) % 2 === 0;
            return (
              <div key={sq} className={dark ? "sq sq-dark" : "sq sq-light"}>
                {piece && (
                  <span className={facesOut(piece.type, sq) ? "piece-wrap face-out" : "piece-wrap"}>
                    <PieceGlyph type={piece.type} color={piece.color} />
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
