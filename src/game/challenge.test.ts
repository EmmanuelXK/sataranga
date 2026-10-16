import assert from "node:assert/strict";
import test from "node:test";
import { legalMoves, startPosition, type Piece } from "./engine.ts";
import {
  applyChallenge,
  challengeAttacks,
  challengeInCheck,
  challengeLegal,
  challengeOutcome,
  challengeStart,
  CHALLENGE_MOVE_MS,
  findKing,
  kingSafety,
  lastChallengeSearch,
  makeChallenge,
  pickChallengeMove,
  type CPiece,
  type ChallengeState,
  type RuleSet,
} from "./challenge.ts";

function at(name: string): number {
  return name.charCodeAt(0) - 97 + (Number(name[1]) - 1) * 8;
}

function blank(): (CPiece | null)[] {
  return Array.from({ length: 64 }, () => null);
}

function put(board: (CPiece | null)[], name: string, color: "w" | "b", type: CPiece["type"]) {
  board[at(name)] = { color, type };
}

function play(state: ChallengeState, from: string, to: string) {
  const move = challengeLegal(state).find((item) => item.from === at(from) && item.to === at(to) && !item.promotion);
  assert.ok(move, `${from}${to}`);
  return applyChallenge(state, move);
}

const MIXED: Record<"w" | "b", RuleSet> = { w: "chess", b: "sataranga" };
const BOTH_CHESS: Record<"w" | "b", RuleSet> = { w: "chess", b: "chess" };
const BOTH_SATA: Record<"w" | "b", RuleSet> = { w: "sataranga", b: "sataranga" };

test("mixed opening gives chess its army and SATARANGA its own", () => {
  const pos = challengeStart();
  assert.equal(pos.rules.w, "chess");
  assert.equal(pos.rules.b, "sataranga");
  assert.equal(pos.board[at("d1")]?.type, "Q");
  assert.equal(pos.board[at("e8")]?.type, "M");
  assert.equal(pos.board[at("d8")]?.type, "K");
  assert.equal(pos.board[at("c1")]?.type, "B");
  assert.equal(pos.board[at("c8")]?.type, "G");
  const white = challengeLegal(pos);
  assert.equal(white.length, 20);
  assert.equal(white.filter((move) => move.piece === "P" && move.to - move.from === 16).length, 8);
  const black = makeChallenge(pos.board, "b", MIXED);
  const replies = challengeLegal(black);
  assert.equal(replies.length, 16);
  assert.equal(replies.filter((move) => move.piece === "P" && Math.abs(move.to - move.from) === 16).length, 0);
  assert.equal(replies.filter((move) => move.castle).length, 0);
});

test("sataranga versus sataranga matches the classic engine", () => {
  const classic = startPosition();
  const mixed = makeChallenge(classic.board as (CPiece | null)[], "w", BOTH_SATA, {
    castle: { w: { K: false, Q: false }, b: { K: false, Q: false } },
  });
  const classicMoves = legalMoves(classic)
    .map((move) => `${move.from}-${move.to}-${move.promotion ? "M" : ""}`)
    .sort();
  const mixedMoves = challengeLegal(mixed)
    .map((move) => `${move.from}-${move.to}-${move.promotion ?? ""}`)
    .sort();
  assert.deepEqual(mixedMoves, classicMoves);

  const board = blank();
  put(board, "d4", "w", "G");
  put(board, "c3", "b", "P");
  put(board, "e5", "w", "K");
  put(board, "a1", "b", "K");
  const gaja = challengeLegal(makeChallenge(board, "w", BOTH_SATA)).filter((move) => move.piece === "G");
  assert.deepEqual(gaja.map((move) => "abcdefgh"[move.to & 7] + String((move.to >> 3) + 1)).sort(), ["b2", "b6", "f2", "f6"]);
});

test("chess castling, en passant, and promotion stay on the chess side", () => {
  const board = blank();
  put(board, "e1", "w", "K");
  put(board, "a1", "w", "R");
  put(board, "h1", "w", "R");
  put(board, "e8", "b", "K");
  const open = challengeLegal(makeChallenge(board, "w", MIXED));
  assert.deepEqual(open.filter((move) => move.castle).map((move) => move.castle).sort(), ["K", "Q"]);
  const castled = applyChallenge(makeChallenge(board, "w", MIXED), open.find((move) => move.castle === "K")!);
  assert.equal(castled.board[at("g1")]?.type, "K");
  assert.equal(castled.board[at("f1")]?.type, "R");
  assert.equal(castled.board[at("e1")], null);
  assert.equal(castled.board[at("h1")], null);
  assert.equal(castled.castle.w.K, false);
  assert.equal(castled.castle.w.Q, false);

  const through = blank();
  put(through, "e1", "w", "K");
  put(through, "a1", "w", "R");
  put(through, "h1", "w", "R");
  put(through, "f8", "b", "R");
  put(through, "a8", "b", "K");
  const blocked = challengeLegal(makeChallenge(through, "w", MIXED));
  assert.equal(blocked.some((move) => move.castle === "K"), false);
  assert.equal(blocked.some((move) => move.castle === "Q"), true);

  const sataranga = blank();
  put(sataranga, "e8", "b", "K");
  put(sataranga, "a8", "b", "R");
  put(sataranga, "h8", "b", "R");
  put(sataranga, "e1", "w", "K");
  const noCastle = challengeLegal(
    makeChallenge(sataranga, "b", MIXED, {
      castle: { w: { K: false, Q: false }, b: { K: true, Q: true } },
    }),
  );
  assert.equal(noCastle.some((move) => move.castle), false);

  const epBoard = blank();
  put(epBoard, "e5", "w", "P");
  put(epBoard, "d5", "b", "P");
  put(epBoard, "a1", "w", "K");
  put(epBoard, "h8", "b", "K");
  const ep = makeChallenge(epBoard, "w", BOTH_CHESS, { ep: at("d6") });
  const capture = challengeLegal(ep).find((move) => move.ep);
  assert.ok(capture);
  assert.equal(capture.to, at("d6"));
  const taken = applyChallenge(ep, capture);
  assert.equal(taken.board[at("d6")]?.type, "P");
  assert.equal(taken.board[at("d5")], null);
  assert.equal(taken.board[at("e5")], null);
  const hewa = makeChallenge(epBoard, "w", { w: "sataranga", b: "chess" }, { ep: at("d6") });
  assert.equal(challengeLegal(hewa).some((move) => move.ep), false);

  const promo = blank();
  put(promo, "a7", "w", "P");
  put(promo, "h1", "w", "K");
  put(promo, "h8", "b", "K");
  const choices = challengeLegal(makeChallenge(promo, "w", MIXED)).filter((move) => move.promotion);
  assert.deepEqual(choices.map((move) => move.promotion).sort(), ["B", "N", "Q", "R"]);
  const queen = applyChallenge(makeChallenge(promo, "w", MIXED), choices.find((move) => move.promotion === "Q")!);
  assert.equal(queen.board[at("a8")]?.type, "Q");

  const hewaPromo = blank();
  put(hewaPromo, "a2", "b", "P");
  put(hewaPromo, "h1", "w", "K");
  put(hewaPromo, "h8", "b", "K");
  const mantri = challengeLegal(makeChallenge(hewaPromo, "b", MIXED)).filter((move) => move.promotion);
  assert.deepEqual(mantri.map((move) => move.promotion), ["M"]);
  assert.equal(applyChallenge(makeChallenge(hewaPromo, "b", MIXED), mantri[0]).board[at("a1")]?.type, "M");
});

test("check is judged by the attacking piece, across both armies", () => {
  const queen = blank();
  put(queen, "e8", "b", "K");
  put(queen, "e1", "w", "K");
  put(queen, "e4", "w", "Q");
  const checked = makeChallenge(queen, "b", MIXED);
  assert.equal(challengeInCheck(checked), true);
  const reply = challengeLegal(checked);
  assert.ok(reply.length > 0);
  assert.ok(reply.every((move) => !challengeInCheck(applyChallenge(checked, move))));

  const leaped = blank();
  put(leaped, "e8", "w", "K");
  put(leaped, "a1", "b", "K");
  put(leaped, "c6", "b", "G");
  put(leaped, "d7", "w", "P");
  assert.equal(challengeAttacks(leaped, at("e8"), "b"), true);
  const bishop = leaped.slice();
  bishop[at("c6")] = { color: "b", type: "B" };
  assert.equal(challengeAttacks(bishop, at("e8"), "b"), false);

  const mantri = blank();
  put(mantri, "e8", "w", "K");
  put(mantri, "a1", "b", "K");
  put(mantri, "c6", "b", "M");
  assert.equal(challengeAttacks(mantri, at("e8"), "b"), false);
  mantri[at("c6")] = { color: "b", type: "B" };
  assert.equal(challengeAttacks(mantri, at("e8"), "b"), true);

  const pinned = blank();
  put(pinned, "e1", "b", "K");
  put(pinned, "e2", "b", "R");
  put(pinned, "e8", "w", "Q");
  put(pinned, "a8", "w", "K");
  const rook = challengeLegal(makeChallenge(pinned, "b", MIXED)).filter((move) => move.piece === "R");
  assert.ok(rook.length > 0);
  assert.ok(rook.every((move) => (move.to & 7) === 4));
});

test("stalemate and bare Raja follow the side that owns the rule", () => {
  const board = blank();
  put(board, "a8", "b", "K");
  put(board, "a7", "b", "P");
  put(board, "a6", "w", "P");
  put(board, "c7", "w", "Q");
  put(board, "h1", "w", "K");
  const chess = challengeOutcome(makeChallenge(board, "b", BOTH_CHESS));
  assert.deepEqual(chess, { kind: "draw", reason: "stalemate" });
  const sata = challengeOutcome(makeChallenge(board, "b", MIXED));
  assert.deepEqual(sata, { kind: "win", winner: "w", reason: "stalemate" });

  const bare = blank();
  put(bare, "a8", "b", "K");
  put(bare, "h1", "w", "K");
  put(bare, "d4", "w", "Q");
  const bareEnd = challengeOutcome(makeChallenge(bare, "b", MIXED));
  assert.ok(bareEnd.kind === "win" && bareEnd.reason === "bare_raja");

  const chessBare = blank();
  put(chessBare, "a1", "w", "K");
  put(chessBare, "h8", "b", "K");
  put(chessBare, "b8", "b", "R");
  const ongoing = challengeOutcome(makeChallenge(chessBare, "w", MIXED));
  assert.equal(ongoing.kind, "ongoing");
});

test("a sheltered Raja is safer than an exposed one by more than a pawn", () => {
  const sheltered = blank();
  put(sheltered, "g8", "b", "K");
  put(sheltered, "f8", "b", "M");
  put(sheltered, "f7", "b", "P");
  put(sheltered, "g7", "b", "P");
  put(sheltered, "h7", "b", "P");
  put(sheltered, "a1", "w", "K");
  const exposed = blank();
  put(exposed, "e4", "b", "K");
  put(exposed, "e8", "w", "Q");
  put(exposed, "a1", "w", "B");
  put(exposed, "h1", "w", "K");
  const calm = kingSafety(makeChallenge(sheltered, "b", MIXED), "b");
  const open = kingSafety(makeChallenge(exposed, "b", MIXED), "b");
  assert.ok(calm - open > 100, `sheltered ${calm} vs exposed ${open}`);
});

test("the bot gets out of check and refuses a queen that walks into mate", () => {
  const checked = blank();
  put(checked, "e8", "b", "K");
  put(checked, "a8", "b", "R");
  put(checked, "e4", "w", "Q");
  put(checked, "h1", "w", "K");
  const state = makeChallenge(checked, "b", MIXED);
  const escape = pickChallengeMove(state);
  assert.ok(escape);
  const fled = applyChallenge(state, escape);
  const raja = findKing(fled.board, "b");
  assert.ok(raja >= 0);
  assert.equal(challengeAttacks(fled.board, raja, "w"), false);

  const trap = blank();
  put(trap, "a1", "w", "K");
  put(trap, "c2", "w", "Q");
  put(trap, "a4", "w", "Q");
  put(trap, "g5", "w", "N");
  put(trap, "h8", "b", "K");
  put(trap, "f8", "b", "R");
  put(trap, "b6", "b", "A");
  const white = makeChallenge(trap, "w", MIXED);
  const mate = challengeLegal(white).find((move) => move.piece === "Q" && move.from === at("c2") && move.to === at("h7"));
  assert.ok(mate);
  const mateEnd = challengeOutcome(applyChallenge(white, mate));
  assert.ok(mateEnd.kind === "win" && mateEnd.reason === "checkmate");
  const black = makeChallenge(trap, "b", MIXED);
  const started = Date.now();
  const reply = pickChallengeMove(black);
  const elapsed = Date.now() - started;
  assert.ok(reply);
  assert.ok(elapsed < 600, `defensive move took ${elapsed}ms`);
  const after = applyChallenge(black, reply);
  const mates = challengeLegal(after).filter((move) => {
    const end = challengeOutcome(applyChallenge(after, move));
    return end.kind === "win" && end.reason === "checkmate";
  });
  assert.equal(mates.length, 0, reply ? `${reply.piece} ${reply.from}-${reply.to}` : "no move");
});

test("bullet search returns a legal move inside the clock", () => {
  assert.ok(CHALLENGE_MOVE_MS <= 250);
  const started = Date.now();
  const move = pickChallengeMove(challengeStart());
  const elapsed = Date.now() - started;
  assert.ok(move);
  assert.ok(challengeLegal(challengeStart()).some((item) => item.from === move.from && item.to === move.to));
  assert.ok(elapsed < 600, `opening move took ${elapsed}ms`);
  const info = lastChallengeSearch();
  assert.ok(info.depth >= 2, `depth ${info.depth} in ${info.ms}ms over ${info.nodes} nodes`);
  assert.ok(info.ms <= 500, `search reported ${info.ms}ms`);
});

test("classic piece values are unchanged by a mixed import", () => {
  const classic = startPosition();
  assert.equal(legalMoves(classic).length, 16);
  const board = classic.board;
  assert.equal((board[at("d1")] as Piece).type, "K");
  assert.equal((board[at("e1")] as Piece).type, "M");
});
