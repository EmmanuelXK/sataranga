import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { BookOpen, Dices, Swords } from "lucide-react";
import {
  ARMY_INK,
  ARMY_NAME,
  FACE_NAME,
  PIECE_NAME,
  PIECE_SET,
  RETRO_PAINT,
  RETRO_SET,
  TURN,
  applyMove,
  chooseMove,
  faceHint,
  leader,
  movesFor,
  movesForFace,
  readPieceSet,
  rollPair,
  skipStep,
  startState,
  viewCell,
  type Army,
  type CMove,
  type CState,
  type CType,
  type Face,
  type PieceSet,
} from "@/game/chaturaji";
import { boardTheme, readBoard } from "@/game/boards";
import { playSound, unlockAudio } from "@/game/sound";
import type { Launch } from "@/game/launch";

const FILE: Record<CType, string> = {
  K: "raja",
  G: "hasthi",
  A: "ashwa",
  Y: "yathra",
  P: "padati",
};

/** NEO stays the flat army color. RETRO is the same shape in vintage enamel, with the same thin black lines. */
function Glyph({ type, army, set }: { type: CType; army: Army; set: PieceSet }) {
  const src = `/pieces/b-${FILE[type]}.svg?v=23`;
  const lines = type !== "Y";
  const paint = set === "retro" ? RETRO_PAINT[army] : null;
  return (
    <i
      className={clsx("cj-piece", paint && "retro", !lines && "ship")}
      style={{
        background: paint
          ? `linear-gradient(152deg, rgba(255,246,226,.78), transparent 34%), linear-gradient(185deg, ${paint.hi} 0%, ${paint.mid} 46%, ${paint.lo} 100%)`
          : ARMY_INK[army],
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
      }}
    >
      {lines && <img src={`/pieces/w-${FILE[type]}.svg?v=23`} alt="" />}
    </i>
  );
}

export function Chaturaji({
  launch,
  onLeave,
}: {
  launch: Extract<Launch, { kind: "chaturaja" }>;
  onLeave: () => void;
}) {
  const theme = boardTheme(readBoard());
  const [set] = useState<PieceSet>(readPieceSet);
  const [game, setGame] = useState<CState>(() => startState(launch.dice));
  const [sel, setSel] = useState<number | null>(null);
  const [spin, setSpin] = useState(false);
  const [cover, setCover] = useState(false);
  const [rules, setRules] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [shown, setShown] = useState<[Face | null, Face | null]>([null, null]);
  const gameRef = useRef(game);
  gameRef.current = game;
  const view: Army = launch.hands === "table" ? game.turn : "red";
  const human = launch.hands === "bots" ? game.turn === "red" : !cover;
  const needsRoll = game.dice && game.rolls.length === 0;
  const options: CMove[] =
    game.over || !human || spin || needsRoll ? [] : game.dice ? (game.face ? movesForFace(game, game.face) : []) : movesFor(game);
  const froms = [...new Set(options.map((m) => m.from))];
  const locked = froms.length === 1 ? froms[0] : sel;
  const targets = locked == null ? [] : options.filter((m) => m.from === locked);

  function noteOf(prev: CState, next: CState, move: CMove | null) {
    if (next.note === "Chaturaji") return `${ARMY_NAME[prev.turn]} takes the four kings`;
    if (next.note === "Boat triumph") return `${ARMY_NAME[prev.turn]} boat triumph`;
    if (next.note === "Sinhasana") return `${ARMY_NAME[prev.turn]} sits a throne`;
    if (next.note.endsWith("falls")) return next.note;
    if (!move) return `${ARMY_NAME[prev.turn]} passes`;
    const piece = prev.board[move.from];
    const cap = move.captured ? ` takes ${PIECE_NAME[move.captured.type]}` : "";
    return `${ARMY_NAME[prev.turn]} ${piece ? PIECE_NAME[piece.type] : ""}${cap}`;
  }

  function commit(next: CState, prev: CState, move: CMove | null) {
    let settled = next;
    if (move && settled.dice && settled.turn === prev.turn && !settled.over && settled.face && !movesForFace(settled, settled.face).length) {
      settled = skipStep(settled);
    }
    const ended = settled.turn !== prev.turn || settled.over;
    setGame(settled);
    setSel(null);
    if (move || (settled.note && settled.note !== prev.note)) {
      setLog((lines) => [noteOf(prev, settled, move), ...lines].slice(0, 6));
    }
    if (move) playSound(move.captured || settled.note === "Boat triumph" || settled.note === "Chaturaji" ? "capture" : "move");
    if (settled.over) playSound("end");
    if (launch.hands === "table" && ended && !settled.over) setCover(true);
  }

  useEffect(() => {
    if (launch.hands !== "bots" || game.over || game.turn === "red" || cover) return;
    let cancel = false;
    const rolls = game.dice ? rollPair() : null;
    setSpin(game.dice);
    if (rolls) setShown([rolls[0], rolls[1]]);
    const timer = window.setTimeout(() => {
      if (cancel) return;
      setSpin(false);
      const prev = gameRef.current;
      let cur: CState = rolls ? { ...prev, rolls, step: 0, face: rolls[0], acted: false, note: "" } : prev;
      for (let i = 0; i < (rolls ? 2 : 1); i++) {
        if (cur.turn !== prev.turn || cur.over) break;
        const face = rolls ? rolls[i] : null;
        const looking = { ...cur, face, step: i as 0 | 1 };
        const moves = face ? movesForFace(looking, face) : movesFor(looking);
        const move = moves.length ? chooseMove(looking.board, moves) : null;
        const last = i === (rolls ? 1 : 0);
        cur = move ? applyMove(looking, move, !last) : skipStep(looking);
      }
      commit(cur, prev, null);
    }, rolls ? 720 : 280);
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.turn, game.passes, game.over, cover, launch.hands]);

  function roll() {
    if (spin || game.over || !human || !game.dice || game.rolls.length > 0) return;
    unlockAudio();
    const rolls = rollPair();
    setShown([rolls[0], rolls[1]]);
    setSpin(true);
    window.setTimeout(() => {
      setSpin(false);
      const prev = gameRef.current;
      let next: CState = { ...prev, rolls, step: 0, face: rolls[0], acted: false, note: "" };
      if (!movesForFace(next, rolls[0]).length) next = skipStep(next);
      if (next.turn === prev.turn && next.step === 1 && next.face && !movesForFace(next, next.face).length) next = skipStep(next);
      commit(next, prev, null);
    }, 720);
  }

  function onSquare(square: number) {
    if (spin || game.over || !human || needsRoll) return;
    const fromsNow = [...new Set(options.map((m) => m.from))];
    const from = fromsNow.length === 1 ? fromsNow[0] : sel;
    const move = from == null ? undefined : options.find((m) => m.from === from && m.to === square);
    if (move) {
      unlockAudio();
      const last = !game.dice || game.step >= 1;
      commit(applyMove(game, move, !last), game, move);
      return;
    }
    if (fromsNow.includes(square)) setSel(square);
  }

  const winner = game.over ? leader(game) : null;
  const hint = game.face && !spin ? faceHint(game, game.face) : "";

  return (
    <main className="cj">
      <header className="cj-top">
        <button type="button" className="cj-text" onClick={onLeave}>
          Lobby
        </button>
        <div>
          <strong>CHATHURAJA</strong>
          <em>{set === "retro" ? "Retro" : "Neo"} · {launch.dice ? "Dice" : "Free"} · four kings</em>
        </div>
        <button type="button" className="cj-text" onClick={() => setRules((v) => !v)} aria-label="Rules">
          <BookOpen strokeWidth={1.75} />
        </button>
      </header>

      {rules && (
        <section className="cj-rules">
          <p>Four armies. No check. A raja can be taken.</p>
          <p>Raja steps one square. Gaja jumps two squares diagonally. Ashva leaps in an L and jumps. Yathra, the war ship, slides any free squares along a rank or file.</p>
          <p>Hewa steps one square forward and takes diagonally forward. It becomes the piece that started behind it, and only after that piece has been taken.</p>
          <p>Two dice, always two different pieces. One side plays both. A blocked piece loses that die. A Hewa stands in only if that piece has already been taken. Raja lets you move the raja or a hewa. You may skip a die. Free play is one move, and ignores the dice.</p>
          <p>Points: hewa 1, yathra 2, ashva 3, gaja 4, raja 5. Four ships in a square is a boat triumph. Taking every enemy raja is Chaturaji, worth 54 more. Highest score wins.</p>
          <p>{set === "retro" ? RETRO_SET : PIECE_SET}. Same shapes. {set === "retro" ? "Vintage enamel, gilt edge, thin black lines." : "Locked flat color, thin black lines."}</p>
        </section>
      )}

      <ol className="cj-scores">
        {TURN.map((army) => (
          <li key={army} className={clsx(game.turn === army && !game.over && "on", !game.alive[army] && "dead")}>
            <i style={{ background: ARMY_INK[army] }} />
            <span>{ARMY_NAME[army]}</span>
            <b>{game.scores[army]}</b>
          </li>
        ))}
      </ol>

      <div className="cj-frame">
        <div className="cj-board" style={{ ["--sq-light" as string]: theme.light, ["--sq-dark" as string]: theme.dark }}>
          {game.board.map((piece, square) => {
            const cell = viewCell(view, square);
            const dark = (square % 8 + Math.floor(square / 8)) % 2 === 0;
            const from = options.some((m) => m.from === square);
            const to = targets.some((m) => m.to === square);
            return (
              <button
                key={square}
                type="button"
                className={clsx("cj-sq", dark ? "dark" : "light", locked === square && "sel", from && "from", to && "to")}
                style={{ gridRow: cell.row + 1, gridColumn: cell.col + 1 }}
                onClick={() => onSquare(square)}
              >
                {piece && <Glyph type={piece.type} army={piece.army} set={set} />}
                {to && <s className={piece ? "cj-cap" : "cj-dot"} />}
              </button>
            );
          })}
        </div>
        {cover && !game.over && (
          <button type="button" className="cj-cover" onClick={() => setCover(false)}>
            <span>Turn the phone</span>
            <strong style={{ color: ARMY_INK[game.turn] }}>{ARMY_NAME[game.turn]}</strong>
            <em>{game.dice ? "Tap, then roll both dice" : "Tap when you are ready"}</em>
          </button>
        )}
      </div>

      <div className="cj-play">
        {game.dice ? (
          <div className="dice-row">
            {([0, 1] as const).map((i) => (
              <button
                key={i}
                type="button"
                className={clsx("ivory-die", spin && "spin", game.rolls.length > 0 && game.step === i && "on")}
                onClick={roll}
                disabled={!human || spin || game.over || game.rolls.length > 0}
                aria-label={shown[i] ? FACE_NAME[shown[i]!] : "Roll the dice"}
              >
                {shown[i] ? <img src={`/pieces/w-${FILE[shown[i]!]}.svg?v=22`} alt="" /> : <span>Roll</span>}
              </button>
            ))}
          </div>
        ) : (
          <span className="cj-free">
            <Swords strokeWidth={1.75} /> Free move
          </span>
        )}
        <div className="cj-status">
          {game.over ? (
            <>
              <strong style={{ color: ARMY_INK[winner!] }}>{ARMY_NAME[winner!]} leads</strong>
              <em>{game.scores[winner!]} points</em>
            </>
          ) : (
            <>
              <strong style={{ color: ARMY_INK[game.turn] }}>{ARMY_NAME[game.turn]}</strong>
              <em>
                {spin
                  ? "The dice turn"
                  : needsRoll
                    ? "Roll both"
                    : game.dice
                      ? `Move ${game.step + 1} of 2`
                      : "Choose a piece"}
              </em>
            </>
          )}
          {hint && <p>{hint}</p>}
          {!hint && log[0] && <p>{log[0]}</p>}
        </div>
      </div>

      <div className="cj-actions">
        {game.dice && game.rolls.length > 0 && human && !spin && !game.over && (
          <button type="button" onClick={() => commit(skipStep(game), game, null)}>
            Skip this die
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setGame(startState(launch.dice));
            setSel(null);
            setCover(false);
            setLog([]);
            setShown([null, null]);
          }}
        >
          <Dices strokeWidth={1.75} /> New
        </button>
        <button type="button" onClick={onLeave}>
          Leave
        </button>
      </div>
    </main>
  );
}
