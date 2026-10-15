import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, mirrorTowardCenter, movesFor, startState, type CType } from "./chaturaji.ts";

test("thirty-two pieces and four rajas", () => {
  const state = startState(true);
  const pieces = state.board.filter(Boolean);
  assert.equal(pieces.length, 32);
  for (const army of ["red", "green", "black", "gold"] as const) {
    assert.equal(pieces.filter((p) => p!.army === army && p!.type === "K").length, 1);
    assert.equal(pieces.filter((p) => p!.army === army && p!.type === "Y").length, 1);
  }
});

test("gaja and ashva art faces the centre of the current view", () => {
  const sq = (file: number, rank: number) => rank * 8 + file;
  const state = startState(false);
  const at = (file: number, rank: number) => state.board[sq(file, rank)]!;
  assert.equal(at(1, 0).type, "A");
  assert.equal(at(2, 0).type, "G");
  assert.equal(mirrorTowardCenter("A", sq(1, 0), "red"), false);
  assert.equal(mirrorTowardCenter("G", sq(2, 0), "red"), false);
  assert.equal(mirrorTowardCenter("A", sq(0, 6), "red"), false);
  assert.equal(mirrorTowardCenter("G", sq(0, 5), "red"), false);
  assert.equal(mirrorTowardCenter("G", sq(5, 7), "red"), true);
  assert.equal(mirrorTowardCenter("A", sq(6, 7), "red"), true);
  assert.equal(mirrorTowardCenter("A", sq(7, 1), "red"), true);
  assert.equal(mirrorTowardCenter("G", sq(7, 2), "red"), true);
  assert.equal(mirrorTowardCenter("A", sq(0, 6), "green"), false);
  assert.equal(mirrorTowardCenter("K", sq(3, 0), "red"), false);
  assert.equal(mirrorTowardCenter("Y", sq(0, 0), "red"), false);
  assert.equal(mirrorTowardCenter("P", sq(1, 1), "red"), false);
  assert.equal(mirrorTowardCenter("A", sq(5, 0), "red"), true);
});

test("gaja jumps two squares diagonally and ashva jumps in an L", () => {
  const state = startState(false);
  const moves = movesFor(state, "red");
  assert.ok(moves.some((m) => m.from === 2 && m.to === 16 && state.board[m.from]?.type === "G"));
  assert.ok(moves.some((m) => m.from === 2 && m.to === 20));
  assert.ok(moves.some((m) => m.from === 1 && m.to === 16 && state.board[m.from]?.type === "A"));
  assert.ok(moves.some((m) => m.from === 1 && m.to === 18));
  assert.equal(moves.filter((m) => m.from === 0).length, 0);
});

test("gold hewa moves toward the a-file", () => {
  const state = startState(false);
  const moves = movesFor(state, "gold");
  const pawn = moves.find((m) => m.from === 6 && !m.captured);
  assert.ok(pawn);
  assert.equal(pawn!.to, 5);
});

test("boat triumph removes the other three ships", () => {
  const state = startState(false);
  state.board[0] = { army: "red", type: "Y" as CType };
  state.board[1] = { army: "green", type: "Y" as CType };
  state.board[8] = { army: "black", type: "Y" as CType };
  state.board[2] = { army: "gold", type: "Y" as CType };
  const move = { from: 2, to: 9, captured: null, promo: null };
  state.board[9] = null;
  const next = applyMove({ ...state, turn: "gold" }, move);
  assert.equal(next.board[9]?.army, "gold");
  assert.equal(next.board[0], null);
  assert.equal(next.board[1], null);
  assert.equal(next.board[8], null);
  assert.equal(next.note, "Boat triumph");
  assert.equal(next.scores.gold, 6);
});
