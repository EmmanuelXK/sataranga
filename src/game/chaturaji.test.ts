import assert from "node:assert/strict";
import test from "node:test";
import { applyMove, movesFor, startState, type CType } from "./chaturaji.ts";

test("thirty-two pieces and four rajas", () => {
  const state = startState(true);
  const pieces = state.board.filter(Boolean);
  assert.equal(pieces.length, 32);
  for (const army of ["red", "green", "black", "gold"] as const) {
    assert.equal(pieces.filter((p) => p!.army === army && p!.type === "K").length, 1);
    assert.equal(pieces.filter((p) => p!.army === army && p!.type === "Y").length, 1);
  }
});

test("gaja jumps two squares diagonally and ashva jumps in an L", () => {
  const state = startState(false);
  const moves = movesFor(state, "red");
  assert.ok(moves.some((m) => m.from === 3 && m.to === 17 && state.board[m.from]?.type === "G"));
  assert.ok(moves.some((m) => m.from === 3 && m.to === 21));
  assert.ok(moves.some((m) => m.from === 1 && m.to === 16 && state.board[m.from]?.type === "A"));
  assert.ok(moves.some((m) => m.from === 1 && m.to === 18));
  assert.equal(moves.filter((m) => m.from === 0).length, 0);
});

test("each army starts symmetric around its raja", () => {
  const state = startState(true);
  const piece = (file: number, rank: number) => state.board[rank * 8 + file];
  const camps = {
    red: { back: [0, 1] as const, squares: [[0, 0], [1, 0], [2, 0], [3, 0]] },
    green: { back: [1, 0] as const, squares: [[0, 7], [0, 6], [0, 5], [0, 4]] },
    black: { back: [0, -1] as const, squares: [[7, 7], [6, 7], [5, 7], [4, 7]] },
    gold: { back: [-1, 0] as const, squares: [[7, 0], [7, 1], [7, 2], [7, 3]] },
  };
  const order = ["Y", "A", "K", "G"] as const;
  for (const army of ["red", "green", "black", "gold"] as const) {
    const camp = camps[army];
    let raja: [number, number] | null = null;
    let gaja: [number, number] | null = null;
    let ashva: [number, number] | null = null;
    camp.squares.forEach(([file, rank], index) => {
      const back = piece(file, rank);
      assert.equal(back?.army, army);
      assert.equal(back?.type, order[index]);
      const pawn = piece(file + camp.back[0], rank + camp.back[1]);
      assert.equal(pawn?.army, army);
      assert.equal(pawn?.type, "P");
      assert.equal(pawn?.promo, order[index]);
      if (order[index] === "K") raja = [file, rank];
      if (order[index] === "G") gaja = [file, rank];
      if (order[index] === "A") ashva = [file, rank];
    });
    assert.ok(raja && gaja && ashva);
    const king = raja as [number, number];
    const elephant = gaja as [number, number];
    const horse = ashva as [number, number];
    assert.deepEqual(
      [elephant[0] - king[0], elephant[1] - king[1]],
      [king[0] - horse[0], king[1] - horse[1]],
    );
    assert.equal(Math.abs(elephant[0] - king[0]) + Math.abs(elephant[1] - king[1]), 1);
    assert.equal(state.thrones[army], king[1] * 8 + king[0]);
  }
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
