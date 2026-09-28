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
