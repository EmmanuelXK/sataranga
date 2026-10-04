import assert from "node:assert/strict";
import test from "node:test";
import {
  applyMove,
  coord,
  formatMove,
  legalMoves,
  makePosition,
  outcome,
  pickAiMove,
  startPosition,
  type Piece,
} from "./engine.ts";

function empty(turn: "w" | "b" = "w") {
  return makePosition(Array.from({ length: 64 }, () => null), turn);
}

function put(pos: ReturnType<typeof empty>, sq: number, piece: Piece) {
  pos.board[sq] = piece;
}

test("opening has sixteen legal moves and the Mantri is not a bishop", () => {
  const pos = startPosition();
  const moves = legalMoves(pos);
  assert.equal(moves.length, 16, moves.map((m) => coord(m.from) + coord(m.to) + m.piece).join(" "));
  assert.equal(moves.filter((m) => m.piece === "M").length, 0);
  assert.equal(moves.filter((m) => m.piece === "K").length, 0);
  assert.equal(moves.filter((m) => m.piece === "R").length, 0);
  assert.equal(moves.filter((m) => m.piece === "P").length, 8);
  assert.equal(moves.filter((m) => m.piece === "A").length, 4);
  assert.equal(moves.filter((m) => m.piece === "G").length, 4);
});

test("Mantri steps one diagonal and Gaja leaps two, ignoring blockers", () => {
  const pos = empty();
  put(pos, 3 + 3 * 8, { color: "w", type: "M" });
  put(pos, 7, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const mantri = legalMoves(pos).filter((m) => m.piece === "M");
  assert.deepEqual(mantri.map((m) => coord(m.to)).sort(), ["c3", "c5", "e3", "e5"]);

  const gpos = empty();
  put(gpos, 3 + 3 * 8, { color: "w", type: "G" });
  put(gpos, 2 + 2 * 8, { color: "b", type: "P" });
  put(gpos, 4 + 4 * 8, { color: "w", type: "K" });
  put(gpos, 0, { color: "b", type: "K" });
  const gaja = legalMoves(gpos).filter((m) => m.piece === "G");
  assert.deepEqual(gaja.map((m) => coord(m.to)).sort(), ["b2", "b6", "f2", "f6"]);
});

test("pawn promotes to Mantri and cannot double-step", () => {
  const pos = empty();
  put(pos, 6 * 8 + 0, { color: "w", type: "P" });
  put(pos, 4, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const moves = legalMoves(pos).filter((m) => m.piece === "P");
  assert.equal(moves.length, 1);
  assert.equal(coord(moves[0].to), "a8");
  assert.equal(moves[0].promotion, true);
  const next = applyMove(pos, moves[0]);
  assert.equal(next.board[7 * 8]?.type, "M");
});

test("pinned ratha cannot leave the Raja's file", () => {
  const pos = empty();
  put(pos, 4, { color: "w", type: "K" });
  put(pos, 4 + 8, { color: "w", type: "R" });
  put(pos, 4 + 7 * 8, { color: "b", type: "R" });
  put(pos, 0, { color: "b", type: "K" });
  const rook = legalMoves(pos).filter((m) => m.piece === "R");
  assert.ok(rook.every((m) => (m.to & 7) === 4));
  assert.ok(rook.some((m) => coord(m.to) === "e8"));
  assert.ok(!rook.some((m) => coord(m.to) === "d2"));
});

test("bare Raja loses unless the bare side can bare back", () => {
  const lost = empty("b");
  put(lost, 56, { color: "b", type: "K" });
  put(lost, 0, { color: "w", type: "K" });
  put(lost, 8 + 7, { color: "w", type: "P" });
  const end = outcome(lost);
  assert.equal(end.kind, "win");
  if (end.kind === "win") assert.equal(end.reason, "bare_raja");

  const draw = empty("b");
  put(draw, 7 * 8 + 0, { color: "b", type: "K" });
  put(draw, 0, { color: "w", type: "K" });
  put(draw, 6 * 8 + 1, { color: "w", type: "P" });
  const mutual = outcome(draw);
  assert.deepEqual(mutual, { kind: "draw", reason: "mutual_bare" });
});

test("stalemate is a loss for the side that cannot move", () => {
  const pos = empty("b");
  put(pos, 56, { color: "b", type: "K" });
  put(pos, 48, { color: "b", type: "P" });
  put(pos, 6 * 8 + 2, { color: "w", type: "K" });
  put(pos, 5 * 8 + 0, { color: "w", type: "P" });
  const end = outcome(pos);
  assert.deepEqual(end, { kind: "win", winner: "w", reason: "stalemate" });
});

test("Raja steps one square any way and cannot castle", () => {
  const pos = empty();
  put(pos, 4, { color: "w", type: "K" });
  put(pos, 7, { color: "w", type: "R" });
  put(pos, 60, { color: "b", type: "K" });
  const king = legalMoves(pos).filter((m) => m.piece === "K");
  assert.deepEqual(king.map((m) => coord(m.to)).sort(), ["d1", "d2", "e2", "f1", "f2"]);
  assert.ok(!king.some((m) => coord(m.to) === "g1" || coord(m.to) === "c1"));
});

test("Mantri is one diagonal step and never orthogonal", () => {
  const pos = empty();
  put(pos, 3 + 3 * 8, { color: "w", type: "M" });
  put(pos, 0, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const mantri = legalMoves(pos).filter((m) => m.piece === "M");
  assert.deepEqual(mantri.map((m) => coord(m.to)).sort(), ["c3", "c5", "e3", "e5"]);
});

test("Gaja leaps exactly two diagonals over a blocker", () => {
  const pos = empty();
  put(pos, 3 + 3 * 8, { color: "w", type: "G" });
  put(pos, 4 + 4 * 8, { color: "b", type: "P" });
  put(pos, 0, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const gaja = legalMoves(pos).filter((m) => m.piece === "G");
  assert.deepEqual(gaja.map((m) => coord(m.to)).sort(), ["b2", "b6", "f2", "f6"]);
  assert.ok(!gaja.some((m) => coord(m.to) === "e5"));
});

test("Ashva jumps in an L and is not blocked", () => {
  const pos = empty();
  put(pos, 4 + 4 * 8, { color: "w", type: "A" });
  put(pos, 4 + 5 * 8, { color: "b", type: "P" });
  put(pos, 5 + 4 * 8, { color: "b", type: "P" });
  put(pos, 0, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const horse = legalMoves(pos).filter((m) => m.piece === "A");
  assert.deepEqual(
    horse.map((m) => coord(m.to)).sort(),
    ["c4", "c6", "d3", "d7", "f3", "f7", "g4", "g6"],
  );
});

test("Ratha slides on ranks and files and stops at a blocker", () => {
  const pos = empty();
  put(pos, 3 + 3 * 8, { color: "w", type: "R" });
  put(pos, 5 + 3 * 8, { color: "b", type: "P" });
  put(pos, 0, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const rook = legalMoves(pos).filter((m) => m.piece === "R");
  const dest = rook.map((m) => coord(m.to));
  assert.ok(dest.includes("f4"));
  assert.ok(!dest.includes("g4"));
  assert.ok(dest.includes("d1") && dest.includes("d8"));
  assert.ok(!dest.includes("e5") && !dest.includes("c5"));
});

test("Hewa steps one square forward, captures diagonally, and has no double step or en passant", () => {
  const pos = empty();
  put(pos, 8 + 3, { color: "w", type: "P" });
  put(pos, 16 + 4, { color: "b", type: "P" });
  put(pos, 16 + 3, { color: "b", type: "P" });
  put(pos, 0, { color: "w", type: "K" });
  put(pos, 63, { color: "b", type: "K" });
  const pawns = legalMoves(pos).filter((m) => m.piece === "P" && m.color === "w");
  assert.deepEqual(pawns.map((m) => coord(m.to)).sort(), ["e3"]);
  assert.equal(pawns[0].captured, "P");
  assert.ok(!pawns.some((m) => coord(m.to) === "d4" || coord(m.to) === "d3"));
});

test("notation and a short engine search stay legal", () => {
  const pos = startPosition();
  const moves = legalMoves(pos);
  const pawn = moves.find((m) => m.piece === "P" && coord(m.to) === "d3");
  assert.ok(pawn);
  assert.equal(formatMove(pos, pawn, moves), "d3");
  const t = Date.now();
  const ai = pickAiMove(pos, 2);
  assert.ok(ai);
  assert.ok(Date.now() - t < 2500);
  assert.ok(moves.some((m) => m.from === ai.from && m.to === ai.to));
});
