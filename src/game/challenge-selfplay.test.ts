import assert from "node:assert/strict";
import test from "node:test";
import {
  applyChallenge,
  challengeLegal,
  challengeOutcome,
  challengeStart,
  kingSafety,
  pickChallengeMove,
  pickLegacyChallengeMove,
  valueOf,
  type ChallengeState,
  type CMove,
} from "./challenge.ts";

/** Shallow chess side: likes captures and its own king, fears a hanging piece. */
function chessStub(state: ChallengeState, salt: number): CMove {
  const moves = challengeLegal(state);
  const ranked: { move: CMove; score: number }[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyChallenge(state, move);
    let score = move.captured ? valueOf(move.captured) * 8 : 0;
    if (move.castle) score += 30;
    score += kingSafety(next, state.turn) * 0.2;
    let worst = 0;
    for (const reply of challengeLegal(next)) {
      if (reply.captured) worst = Math.max(worst, valueOf(reply.captured));
    }
    score -= worst * 6;
    if (score > bestScore) bestScore = score;
    ranked.push({ move, score });
  }
  const pool = ranked.filter((row) => row.score >= bestScore - 8);
  return pool[salt % pool.length]?.move ?? moves[0];
}

function blackScore(state: ChallengeState): number {
  let material = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    material += (piece.color === "b" ? 1 : -1) * valueOf(piece.type);
  }
  return material + kingSafety(state, "b") - kingSafety(state, "w");
}

const MATCH_PLIES = 40;

function playGame(kind: "new" | "old", salt: number): { result: "win" | "loss" | "draw" | "unfinished"; score: number } {
  let state = challengeStart();
  // Finish depth 3. A clock cutoff would change the move when the machine is busy.
  const search = { ms: 8_000, nodes: 400_000, maxDepth: 3 };
  for (let ply = 0; ply < MATCH_PLIES && challengeOutcome(state).kind === "ongoing"; ply++) {
    const move =
      state.turn === "w"
        ? chessStub(state, salt + ply)
        : kind === "new"
          ? pickChallengeMove(state, search)
          : pickLegacyChallengeMove(state, search);
    assert.ok(move, `${kind} produced no move`);
    assert.ok(
      challengeLegal(state).some((item) => item.from === move.from && item.to === move.to && item.promotion === move.promotion),
      "illegal bot move",
    );
    state = applyChallenge(state, move);
  }
  const end = challengeOutcome(state);
  const score = blackScore(state);
  if (end.kind === "ongoing") return { result: "unfinished", score };
  if (end.kind === "draw") return { result: "draw", score };
  return { result: end.winner === "b" ? "win" : "loss", score };
}

function points(rows: Array<"win" | "loss" | "draw" | "unfinished">): number {
  return rows.reduce((sum, row) => sum + (row === "win" ? 1 : row === "draw" ? 0.5 : 0), 0);
}

test("new SATARANGA bot against the old bot, chess side played by a stub", { timeout: 120_000 }, () => {
  const games = 10;
  // The book draws one reply at random. Pin that draw so the match can be repeated.
  let bookDraw = 0;
  const random = Math.random;
  Math.random = () => {
    bookDraw = (bookDraw + 1) % 997;
    return bookDraw / 997;
  };
  let fresh: ReturnType<typeof playGame>[];
  let legacy: ReturnType<typeof playGame>[];
  try {
    fresh = Array.from({ length: games }, (_, i) => playGame("new", i * 3));
    legacy = Array.from({ length: games }, (_, i) => playGame("old", i * 3));
  } finally {
    Math.random = random;
  }
  const mean = (rows: { score: number }[]) => rows.reduce((sum, row) => sum + row.score, 0) / rows.length;
  const pack = (rows: { result: "win" | "loss" | "draw" | "unfinished"; score: number }[]) => ({
    wins: rows.filter((row) => row.result === "win").length,
    losses: rows.filter((row) => row.result === "loss").length,
    draws: rows.filter((row) => row.result === "draw").length,
    unfinished: rows.filter((row) => row.result === "unfinished").length,
    points: points(rows.map((row) => row.result)),
    meanScore: Math.round(mean(rows)),
  });
  const summary = { gamesEach: games, plies: MATCH_PLIES, newBot: pack(fresh), oldBot: pack(legacy) };
  console.log(`SELFPLAY ${JSON.stringify(summary)}`);
  assert.equal(fresh.length + legacy.length, 20);
  assert.ok(summary.newBot.meanScore >= summary.oldBot.meanScore, JSON.stringify(summary));
});
