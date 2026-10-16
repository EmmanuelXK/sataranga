import { useEffect, useRef, useState } from "react";
import { Board } from "@/components/Chaturanga";
import { boardTheme } from "@/game/boards";
import { applyMove, inCheck, kingSquare, legalMoves, type Move, type Position } from "@/game/engine";
import {
  loadPuzzleRecord,
  localDayKey,
  markPuzzleSolved,
  moveWins,
  positionFromSetup,
  previousDayKey,
  puzzleForDate,
  sideName,
  streakStatus,
  type DailyPuzzle,
  type PuzzleRecord,
} from "@/game/puzzles";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function dateLine(date: Date): string {
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function caption(streak: number, solvedToday: boolean): string {
  if (solvedToday) return "Solved today. The streak is safe.";
  if (streak > 0) return "Solve today to keep the streak.";
  return "Solve today to start a streak.";
}

export function DailyPuzzle() {
  const [now, setNow] = useState(() => new Date());
  const [record, setRecord] = useState<PuzzleRecord>(() => loadPuzzleRecord());
  const today = localDayKey(now);
  const status = streakStatus(record, today, previousDayKey(now));
  const puzzle = puzzleForDate(now);

  useEffect(() => {
    const tick = () => {
      const nextKey = localDayKey(new Date());
      if (nextKey !== today) setNow(new Date());
    };
    document.addEventListener("visibilitychange", tick);
    const id = window.setInterval(tick, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", tick);
      window.clearInterval(id);
    };
  }, [today]);

  function onSolved() {
    const next = markPuzzleSolved(now);
    setRecord(next);
  }

  return (
    <section className="hall-panel puzzles-page" aria-labelledby="puzzles-title">
      <div className="puzzle-head">
        <h2 id="puzzles-title">Daily Puzzle</h2>
        <p className="puzzle-count" aria-label={`${status.streak} day streak`}>
          {status.streak} {status.streak === 1 ? "day" : "days"}
        </p>
      </div>
      <p className="puzzle-brief">
        {caption(status.streak, status.solvedToday)} · {dateLine(now)}
      </p>
      <PuzzleCard key={today} puzzle={puzzle} solvedToday={status.solvedToday} onSolved={onSolved} />
    </section>
  );
}

function PuzzleCard({
  puzzle,
  solvedToday,
  onSolved,
}: {
  puzzle: DailyPuzzle;
  solvedToday: boolean;
  onSolved: () => void;
}) {
  const start = positionFromSetup(puzzle.setup, puzzle.side);
  const solution = legalMoves(start).find((move) => moveWins(start, move)) ?? null;
  const done = solution ? applyMove(start, solution) : start;
  const [solved, setSolved] = useState(solvedToday);
  const [showStart, setShowStart] = useState(false);
  const [misses, setMisses] = useState(0);
  const [pos, setPos] = useState<Position>(solvedToday && solution ? done : start);
  const [last, setLast] = useState<Move | null>(solvedToday ? solution : null);
  const [selected, setSelected] = useState<number | null>(null);
  const [note, setNote] = useState(solvedToday ? puzzle.solved : "");
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!note || solvedToday) return;
    statusRef.current?.scrollIntoView({ block: "nearest" });
  }, [note, solved, solvedToday]);

  const playing = !solved;
  const legal = playing ? legalMoves(pos) : [];
  const targets = selected == null ? [] : legal.filter((move) => move.from === selected).map((move) => move.to);
  const checkSq = inCheck(pos) ? kingSquare(pos.board, pos.turn) : -1;
  const squares = boardTheme("brown");

  function onMove(from: number, to: number) {
    if (!playing) return;
    const move = legal.find((item) => item.from === from && item.to === to);
    if (!move) return;
    if (!moveWins(pos, move)) {
      setSelected(null);
      setMisses((count) => count + 1);
      setNote("That move does not win.");
      return;
    }
    setPos(applyMove(pos, move));
    setLast(move);
    setSelected(null);
    setSolved(true);
    setShowStart(false);
    setNote(puzzle.solved);
    onSolved();
  }

  function revealStart() {
    setShowStart(true);
    setPos(start);
    setLast(null);
    setSelected(null);
  }

  function revealWin() {
    if (!solution) return;
    setShowStart(false);
    setPos(done);
    setLast(solution);
    setSelected(null);
  }

  return (
    <>
      <div className="puzzle-title-row">
        <h3>{puzzle.title}</h3>
        {solved && <p className="puzzle-seal">Solved today</p>}
      </div>
      <p className="puzzle-goal">
        {sideName(puzzle.side)} to move. {puzzle.goal}
      </p>
      <p className="puzzle-rule">{puzzle.rule}</p>
      <div className="ms-game puzzle-board">
        <div className="frame">
          <Board
            board={pos.board}
            orientation={puzzle.side}
            squares={squares}
            selected={selected}
            targets={targets}
            last={last}
            checkSq={checkSq}
            flight={null}
            landSq={null}
            interactive={playing}
            turn={pos.turn}
            onSelect={setSelected}
            onMove={onMove}
          />
        </div>
      </div>
      <p className="puzzle-status" role="status" ref={statusRef}>
        {note || "One winning move. A wrong try does not spend the day."}
        {misses > 0 && playing ? ` Look at the ${puzzle.actor}.` : ""}
      </p>
      {solved && (
        <button type="button" className="puzzle-quiet" onClick={showStart ? revealWin : revealStart}>
          {showStart ? "Show the winning move" : "See the start"}
        </button>
      )}
    </>
  );
}
