import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { ChessGlyph } from "@/components/challenge-pieces";
import { PieceGlyph } from "@/components/pieces";
import {
  applyChallenge,
  challengeInCheck,
  challengeLegal,
  challengeOutcome,
  challengePaceMs,
  challengeStart,
  findKing,
  loadChallengePace,
  loadChallengeRecord,
  pieceName,
  pickChallengeMove,
  saveChallengePace,
  saveChallengeResult,
  type ChallengePace,
  type ChallengeEnd,
  type ChallengeRecord,
  type ChallengeState,
  type CMove,
  type CPiece,
} from "@/game/challenge";
import { coord, type PieceType } from "@/game/engine";

function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  const totalTenths = Math.ceil(clamped / 100);
  const sec = Math.floor(totalTenths / 10);
  const tenth = totalTenths % 10;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes === 0 && sec < 10) return `0:0${seconds}.${tenth}`;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function resultKind(end: ChallengeEnd): "win" | "loss" | "draw" {
  if (end.kind === "win") return end.winner === "w" ? "win" : "loss";
  return "draw";
}

function statusLine(live: boolean, thinking: boolean, pos: ChallengeState, result: ChallengeEnd | null, pace: ChallengePace): string {
  if (!live) {
    return pace === "blitz" ? "Three minutes on your clock. You move first." : "One minute on your clock. You move first.";
  }
  if (!result && thinking) return "SATARANGA is thinking.";
  if (!result) {
    if (challengeInCheck(pos)) return pos.turn === "w" ? "Check. Your king is attacked." : "Check. The Raja is attacked.";
    return pos.turn === "w" ? "Your move." : "SATARANGA to move.";
  }
  if (result.kind === "draw") {
    if (result.reason === "stalemate") return "Stalemate. Chess has no move. Drawn.";
    if (result.reason === "repetition") return "Drawn by repetition.";
    if (result.reason === "fifty") return "Drawn by the fifty-move rule.";
    if (result.reason === "mutual_bare") return "Both kings are bare. Drawn.";
    return "Lone kings. Drawn.";
  }
  if (result.kind !== "win") return "The duel is over.";
  const chessWins = result.winner === "w";
  if (result.reason === "time") return chessWins ? "Time. Chess wins." : "Time. SATARANGA wins.";
  if (result.reason === "checkmate") return chessWins ? "Checkmate. The Raja falls." : "Checkmate. Chess loses.";
  if (result.reason === "stalemate") return "Stalemate. SATARANGA has no move, and that is a loss.";
  if (result.reason === "bare_raja") return "Bare Raja. Chess wins.";
  return chessWins ? "Chess wins." : "SATARANGA wins.";
}

function ArmyGlyph({ piece }: { piece: CPiece }) {
  if (piece.color === "b") return <PieceGlyph type={piece.type as PieceType} color="b" />;
  return <ChessGlyph type={piece.type} />;
}

export function Challenge() {
  const [record, setRecord] = useState<ChallengeRecord>({ v: 1, wins: 0, losses: 0, draws: 0 });
  const [pos, setPos] = useState<ChallengeState>(() => challengeStart());
  const [live, setLive] = useState(false);
  const [result, setResult] = useState<ChallengeEnd | null>(null);
  const [last, setLast] = useState<CMove | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [promo, setPromo] = useState<CMove[] | null>(null);
  const [pace, setPace] = useState<ChallengePace>(() => loadChallengePace());
  const [clock, setClock] = useState(() => challengePaceMs(loadChallengePace()));
  const [thinking, setThinking] = useState(false);
  const saved = useRef(false);
  const ticket = useRef(0);
  const posRef = useRef(pos);
  const clockRef = useRef(clock);
  posRef.current = pos;
  clockRef.current = clock;

  useEffect(() => {
    setRecord(loadChallengeRecord());
  }, []);

  useEffect(() => {
    if (!result || saved.current) return;
    saved.current = true;
    setRecord(saveChallengeResult(resultKind(result)));
  }, [result]);

  useEffect(() => {
    if (!live || result || pos.turn !== "w") return;
    let lastTick = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTick;
      lastTick = now;
      const left = clockRef.current - delta;
      if (left <= 0) {
        setClock(0);
        setResult((current) => current ?? { kind: "win", winner: "b", reason: "time" });
        return;
      }
      setClock(left);
    }, 100);
    return () => window.clearInterval(id);
  }, [live, result, pos.turn]);

  useEffect(() => {
    if (!live || result || pos.turn !== "b") return;
    const current = pos;
    const mine = ++ticket.current;
    setThinking(true);
    let worker: Worker | null = null;
    let settled = false;
    const finish = (move: CMove | null) => {
      if (settled || mine !== ticket.current) return;
      settled = true;
      setThinking(false);
      if (!move) return;
      const next = applyChallenge(current, move);
      setPos(next);
      setLast(move);
      const outcome = challengeOutcome(next);
      if (outcome.kind !== "ongoing") setResult(outcome);
    };
    try {
      worker = new Worker(new URL("../game/challenge.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<CMove | null>) => finish(event.data);
      worker.onerror = () => finish(pickChallengeMove(current));
      worker.postMessage(current);
    } catch {
      finish(pickChallengeMove(current));
    }
    return () => {
      settled = true;
      worker?.terminate();
      setThinking(false);
    };
  }, [live, result, pos]);

  const legal = useMemo(() => (live && !result && pos.turn === "w" ? challengeLegal(pos) : []), [live, result, pos]);
  const targets = useMemo(() => {
    const squares = new Set<number>();
    if (selected == null) return squares;
    for (const move of legal) if (move.from === selected) squares.add(move.to);
    return squares;
  }, [legal, selected]);
  const checkSq = live && !result && challengeInCheck(pos) ? findKing(pos.board, pos.turn) : -1;

  function commit(move: CMove) {
    const next = applyChallenge(pos, move);
    setPos(next);
    setLast(move);
    setSelected(null);
    setPromo(null);
    const outcome = challengeOutcome(next);
    if (outcome.kind !== "ongoing") setResult(outcome);
  }

  function onSquare(sq: number) {
    if (!live || result || thinking || pos.turn !== "w") return;
    const choices = selected == null ? [] : legal.filter((move) => move.from === selected && move.to === sq);
    if (choices.length > 1) {
      setPromo(choices);
      return;
    }
    if (choices.length === 1) {
      commit(choices[0]);
      return;
    }
    setPromo(null);
    const piece = pos.board[sq];
    setSelected(piece && piece.color === "w" ? sq : null);
  }

  function choosePace(next: ChallengePace) {
    setPace(next);
    saveChallengePace(next);
    if (!live || result) setClock(challengePaceMs(next));
  }

  function begin() {
    ticket.current += 1;
    saved.current = false;
    setPos(challengeStart());
    setLast(null);
    setSelected(null);
    setPromo(null);
    setClock(challengePaceMs(pace));
    setResult(null);
    setThinking(false);
    setLive(true);
  }

  const interactive = live && !result && !thinking && pos.turn === "w";
  const ranks = [7, 6, 5, 4, 3, 2, 1, 0];
  const files = [0, 1, 2, 3, 4, 5, 6, 7];

  const draws = record.draws > 0 ? ` · ${record.draws} ${record.draws === 1 ? "draw" : "draws"}` : "";

  return (
    <section className="hall-panel challenge-page" aria-labelledby="challenge-title">
      <div className="challenge-head">
        <h2 id="challenge-title">Challenge</h2>
        <p className="challenge-record">
          On this device · {record.wins} {record.wins === 1 ? "win" : "wins"} · {record.losses}{" "}
          {record.losses === 1 ? "loss" : "losses"}
          {draws}
        </p>
      </div>
      <p className="challenge-brief">You play chess · SATARANGA bot · unrated</p>
      <div className="challenge-paces" role="group" aria-label="Your clock">
        <button type="button" className={clsx(pace === "bullet" && "on")} aria-pressed={pace === "bullet"} disabled={live && !result} onClick={() => choosePace("bullet")}>
          Bullet
        </button>
        <button type="button" className={clsx(pace === "blitz" && "on")} aria-pressed={pace === "blitz"} disabled={live && !result} onClick={() => choosePace("blitz")}>
          Blitz
        </button>
        <button type="button" className="locked" disabled aria-disabled="true" title="Premium">
          <span className="challenge-pace-name">
            <LockMark />
            Rapid
          </span>
          <em>Premium</em>
        </button>
        <button type="button" className="locked" disabled aria-disabled="true" title="Premium">
          <span className="challenge-pace-name">
            <LockMark />
            Classic
          </span>
          <em>Premium</em>
        </button>
      </div>
      <div className="ms-game challenge-board">
        <p className="challenge-bot">SATARANGA BOT · no clock</p>
        <div className="frame">
          <div className="board" role="grid" aria-label="Challenge board. You play white, chess. SATARANGA plays black.">
            {ranks.map((rank) =>
              files.map((file) => {
                const sq = rank * 8 + file;
                const piece = pos.board[sq];
                const dark = (file + rank) % 2 === 0;
                const showFile = rank === 0;
                const showRank = file === 0;
                return (
                  <button
                    key={sq}
                    type="button"
                    className={clsx(
                      "sq",
                      dark ? "sq-dark" : "sq-light",
                      selected === sq && "sq-selected",
                      last && (last.from === sq || last.to === sq) && "sq-last",
                      checkSq === sq && "sq-check",
                    )}
                    tabIndex={interactive ? 0 : -1}
                    aria-label={`${coord(sq)}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${pieceName(piece)}` : ""}`}
                    onClick={() => onSquare(sq)}
                  >
                    {showRank && <i className={clsx("coord rank", dark ? "coord-on-dark" : "coord-on-light")}>{rank + 1}</i>}
                    {showFile && (
                      <i className={clsx("coord file", dark ? "coord-on-dark" : "coord-on-light")}>{"abcdefgh"[file]}</i>
                    )}
                    {piece && (
                      <span className="piece-wrap">
                        <ArmyGlyph piece={piece} />
                      </span>
                    )}
                    {targets.has(sq) && !piece && <i className="dot" />}
                    {targets.has(sq) && piece && <i className="ring" />}
                  </button>
                );
              }),
            )}
          </div>
        </div>
        <p className={clsx("challenge-clock", live && !result && pos.turn === "w" && "on")}>
          <span>You · Chess</span>
          <b>{formatClock(clock)}</b>
        </p>
      </div>
      <p className="challenge-status" role="status">
        {statusLine(live, thinking, pos, result, pace)}
      </p>
      {promo && (
        <div className="challenge-promo" role="group" aria-label="Promote the pawn">
          {promo.map((move) => (
            <button key={move.promotion} type="button" onClick={() => commit(move)}>
              <ChessGlyph type={move.promotion ?? "Q"} />
              <span>{move.promotion === "Q" ? "Queen" : move.promotion === "R" ? "Rook" : move.promotion === "B" ? "Bishop" : "Knight"}</span>
            </button>
          ))}
        </div>
      )}
      {(!live || result) && (
        <button type="button" className="challenge-go" onClick={begin}>
          {result ? "New duel" : "Begin the duel"}
        </button>
      )}
    </section>
  );
}

function LockMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.2" y="7" width="9.6" height="7" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
