import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, coord, inCheck, outcome } from "./engine.ts";
import {
  DAILY_PUZZLES,
  freshPuzzleRecord,
  localDayKey,
  localDayNumber,
  positionFromSetup,
  previousDayKey,
  puzzleForDate,
  recordSolve,
  streakStatus,
  winningMoves,
} from "./puzzles.ts";

test("every daily puzzle is one SATARANGA win and not a king capture", () => {
  const ids = new Set<string>();
  for (const puzzle of DAILY_PUZZLES) {
    assert.equal(ids.has(puzzle.id), false, puzzle.id);
    ids.add(puzzle.id);
    const pos = positionFromSetup(puzzle.setup, puzzle.side);
    assert.equal(outcome(pos).kind, "ongoing", puzzle.id);
    assert.equal(inCheck(pos), false, puzzle.id);
    const wins = winningMoves(pos);
    assert.equal(wins.length, 1, `${puzzle.id} wins: ${wins.map((m) => coord(m.from) + coord(m.to)).join(" ")}`);
    const move = wins[0];
    assert.equal(coord(move.from), puzzle.from, puzzle.id);
    assert.equal(coord(move.to), puzzle.to, puzzle.id);
    assert.notEqual(move.captured, "K", puzzle.id);
    const end = outcome(applyMove(pos, move));
    assert.equal(end.kind, "win", puzzle.id);
    if (end.kind === "win") {
      assert.equal(end.winner, puzzle.side, puzzle.id);
      assert.equal(end.reason, puzzle.reason, puzzle.id);
    }
  }
});

test("the catalog uses SATARANGA rules that are not chess-queen mates", () => {
  const reasons = new Set(DAILY_PUZZLES.map((puzzle) => puzzle.reason));
  assert.equal(reasons.has("checkmate"), true);
  assert.equal(reasons.has("stalemate"), true);
  assert.equal(reasons.has("bare_raja"), true);
  assert.ok(DAILY_PUZZLES.some((puzzle) => puzzle.id === "promotion" && puzzle.to === "b8"));
  assert.ok(DAILY_PUZZLES.some((puzzle) => puzzle.actor === "Mantri"));
  assert.ok(DAILY_PUZZLES.some((puzzle) => puzzle.actor === "Gaja"));
});

test("a local calendar day picks one puzzle and the next day picks another", () => {
  const evening = new Date(2026, 9, 15, 23, 30);
  const morning = new Date(2026, 9, 15, 8, 5);
  const next = new Date(2026, 9, 16, 0, 10);
  assert.equal(localDayKey(evening), "2026-10-15");
  assert.equal(puzzleForDate(evening).id, puzzleForDate(morning).id);
  assert.notEqual(puzzleForDate(evening).id, puzzleForDate(next).id);
  assert.equal(localDayNumber(next) - localDayNumber(evening), 1);
  assert.equal(previousDayKey(new Date(2026, 0, 1, 12)), "2025-12-31");
});

test("solving today once keeps the streak, and a missed day resets it", () => {
  const empty = freshPuzzleRecord();
  assert.deepEqual(streakStatus(empty, "2026-10-15", "2026-10-14"), { streak: 0, solvedToday: false });

  const first = recordSolve(empty, "2026-10-15", "2026-10-14");
  assert.deepEqual(first, { v: 1, streak: 1, lastSolved: "2026-10-15" });
  assert.equal(recordSolve(first, "2026-10-15", "2026-10-14").streak, 1);
  assert.deepEqual(streakStatus(first, "2026-10-15", "2026-10-14"), { streak: 1, solvedToday: true });

  assert.deepEqual(streakStatus(first, "2026-10-16", "2026-10-15"), { streak: 1, solvedToday: false });
  const second = recordSolve(first, "2026-10-16", "2026-10-15");
  assert.equal(second.streak, 2);
  assert.equal(second.lastSolved, "2026-10-16");

  assert.deepEqual(streakStatus(second, "2026-10-18", "2026-10-17"), { streak: 0, solvedToday: false });
  const restarted = recordSolve(second, "2026-10-18", "2026-10-17");
  assert.deepEqual(restarted, { v: 1, streak: 1, lastSolved: "2026-10-18" });
});
