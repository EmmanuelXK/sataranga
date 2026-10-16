import assert from "node:assert/strict";
import { test } from "node:test";
import { legalMoves, outcome, applyMove, startPosition, type Move } from "./engine.ts";
import {
  INSIGHT_MIN_GAMES,
  analyze,
  archiveInsight,
  forgetInsight,
  loadInsights,
  walkGame,
  type Trace,
  type TraceMove,
} from "./insights.ts";

function traceMove(move: Move, thinkMs: number): TraceMove {
  return {
    from: move.from,
    to: move.to,
    piece: move.piece,
    color: move.color,
    captured: move.captured,
    promotion: move.promotion,
    thinkMs,
  };
}

function play(seat: "w" | "b", result: Trace["result"], plies: number, at: number, thinkMs = 2200): Trace {
  let pos = startPosition();
  const moves: TraceMove[] = [];
  for (let i = 0; i < plies && outcome(pos).kind === "ongoing"; i++) {
    const legal = legalMoves(pos);
    const quiet = legal.filter((move) => !move.captured && move.piece !== "R" && move.piece !== "K");
    const pool = quiet.length ? quiet : legal;
    const move = pool[0];
    if (!move) break;
    const mine = move.color === seat;
    moves.push(traceMove(move, mine ? thinkMs : -1));
    pos = applyMove(pos, move);
  }
  return { id: `${seat}-${result}-${at}`, at, seat, result, moves };
}

test("a game is scored from the seat the player took", () => {
  const light = play("w", "draw", 6, 1);
  const dark = { ...light, id: "dark", seat: "b" as const };
  const fromLight = walkGame(light);
  const fromDark = walkGame(dark);
  assert.ok(fromLight && fromDark);
  assert.equal(fromLight.evals.length, light.moves.length + 1);
  assert.deepEqual(
    fromDark.evals,
    fromLight.evals.map((n) => -n),
  );
});

test("captures out of check are aggressive and checks are defensive", () => {
  let pos = startPosition();
  const moves: TraceMove[] = [];
  let sawCapture = false;
  let sawCheck = false;
  for (let i = 0; i < 48 && outcome(pos).kind === "ongoing" && (!sawCapture || !sawCheck); i++) {
    const legal = legalMoves(pos);
    const move = legal.find((item) => item.captured) ?? legal[0];
    if (!move) break;
    moves.push(traceMove(move, move.color === "w" ? 1800 : -1));
    if (move.captured) sawCapture = true;
    pos = applyMove(pos, move);
    if (outcome(pos).kind === "ongoing") {
      const reply = legalMoves(pos)[0];
      if (reply) {
        moves.push(traceMove(reply, -1));
        pos = applyMove(pos, reply);
      }
    }
  }
  const walk = walkGame({ id: "mix", at: 1, seat: "w", result: "draw", moves });
  assert.ok(walk);
  for (const fact of walk.moves) {
    if (fact.inCheck) assert.equal(fact.class, "defensive");
  }
  if (sawCapture) assert.ok(walk.moves.some((fact) => fact.class === "aggressive" || fact.inCheck));
});

test("instant moves in a big swing are flagged, slow ones are not", () => {
  const slow = play("w", "win", 16, 1, 2400);
  const hurried = play("w", "loss", 16, 2, 200);
  const calm = walkGame(slow);
  const rush = walkGame(hurried);
  assert.ok(calm && rush);
  assert.equal(calm.moves.some((fact) => fact.instantCritical), false);
  for (const fact of rush.moves) {
    if (fact.instantCritical) {
      assert.ok(fact.thinkMs >= 0 && fact.thinkMs < 1000);
      assert.ok(Math.abs(fact.delta) >= 150);
    }
  }
});

test("five games produce scores, a colour table, and no white or black framing", () => {
  const games = [
    play("w", "win", 18, 1, 2600),
    play("w", "loss", 18, 2, 2600),
    play("b", "win", 18, 3, 300),
    play("w", "draw", 20, 4, 4000),
    play("b", "loss", 14, 5, 1900),
  ];
  assert.equal(analyze(games.slice(0, 4)).ready, false);
  const report = analyze(games);
  assert.equal(report.ready, true);
  assert.equal(report.kept, INSIGHT_MIN_GAMES);
  for (const score of [
    report.strategic.score,
    report.time.score,
    report.positional.score,
    report.psychology.score,
    report.choices.score,
  ]) {
    assert.ok(score >= 0 && score <= 100, String(score));
  }
  assert.equal(report.strategic.series.length, 5);
  assert.equal(report.strategic.series[0].label, "Game 1");
  assert.deepEqual(
    report.choices.colours.map((row) => row.name),
    ["Light pieces", "Dark pieces"],
  );
  const light = report.choices.colours[0];
  const dark = report.choices.colours[1];
  assert.equal(light.games, 3);
  assert.equal(light.wins, 1);
  assert.equal(dark.games, 2);
  assert.equal(dark.wins, 1);
  assert.equal(report.strategic.winningPositions >= report.strategic.wonFromThere, true);
  const text = [
    report.strategic.tip,
    report.time.tip,
    report.positional.tip,
    report.psychology.tip,
    report.choices.tip,
  ].join(" ");
  assert.doesNotMatch(text, /as White|as Black|White\/Black/i);
  assert.match(text, /Raja|piece|game|move|centre|time|pieces/i);
});

test("winning positions are games whose eval peaked for the player", () => {
  const games = [1, 2, 3, 4, 5].map((at) => play(at % 2 ? "w" : "b", at === 1 ? "win" : "loss", 12, at));
  const report = analyze(games);
  let winning = 0;
  let won = 0;
  for (const game of games) {
    const walk = walkGame(game);
    assert.ok(walk);
    if (walk.peak >= 200) {
      winning += 1;
      if (game.result === "win") won += 1;
    }
  }
  assert.equal(report.strategic.winningPositions, winning);
  assert.equal(report.strategic.wonFromThere, won);
});

test("saved games are draws or wins from a clearly worse position", () => {
  const games = [
    play("w", "win", 16, 1),
    play("w", "draw", 16, 2),
    play("b", "loss", 16, 3),
    play("b", "win", 16, 4),
    play("w", "loss", 16, 5),
  ];
  const report = analyze(games);
  const saved = games.filter((game) => {
    const walk = walkGame(game);
    return walk && walk.floor <= -200 && (game.result === "win" || game.result === "draw");
  }).length;
  assert.equal(report.psychology.saved, saved);
});

test("think-time bars average only the player's timed moves", () => {
  const games = [1, 2, 3, 4, 5].map((at) => play("w", "draw", 20, at, 2000));
  const report = analyze(games);
  assert.equal(report.time.bars.opening, 2000);
  const opening = games.flatMap((game) => walkGame(game)?.moves.filter((move) => move.phase === "opening") ?? []);
  assert.ok(opening.length > 0);
  assert.ok(opening.every((move) => move.thinkMs === 2000));
});

test("a rim piece that never moves is listed after the opening", () => {
  const game = play("w", "draw", 18, 1);
  const walk = walkGame(game);
  assert.ok(walk);
  assert.ok(walk.bad.some((row) => row.piece === "Ratha" && row.moves >= 3));
});

test("the archive is its own key and can forget a game", () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    },
  });
  const game = play("b", "win", 4, 9);
  archiveInsight(game);
  assert.equal(loadInsights()[0]?.seat, "b");
  assert.equal(store.has("sataranga-insights-v1"), true);
  assert.equal(store.has("chaturanga-pvp-v1"), false);
  assert.equal(store.has("chaturanga-career-v1"), false);
  assert.equal(store.has("yuddha-profile-v1"), false);
  forgetInsight(game.id);
  assert.equal(loadInsights().length, 0);
});
