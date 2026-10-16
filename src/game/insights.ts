import {
  PIECE_META,
  applyMove,
  coord,
  fileOf,
  inCheck,
  isAttacked,
  kingSquare,
  legalMoves,
  materialQuarters,
  other,
  outcome,
  rankOf,
  startPosition,
  staticEval,
  type Color,
  type Move,
  type PieceType,
  type Position,
} from "./engine.ts";

export const INSIGHTS_KEY = "sataranga-insights-v1";
export const INSIGHT_CLOCKS_KEY = "sataranga-insight-clocks-v1";
export const INSIGHT_CACHE_KEY = "sataranga-insights-cache-v1";

export const INSIGHT_MIN_GAMES = 5;
export const WINNING_CP = 200;
export const SWING_CP = 150;
export const INSTANT_MS = 1000;
export const BLUNDER_CP = 40;
export const WORSE_CP = 200;
export const THREAT_CP = 80;
export const REPLY_CP = 40;
export const RIM_AFTER_PLY = 12;
export const RIM_STAY_PLIES = 6;
export const ENDGAME_QUARTERS = 80;
export const OPENING_MOVES = 8;
const MAX_GAMES = 30;

export type PlayerResult = "win" | "loss" | "draw";
export type Phase = "opening" | "middlegame" | "endgame";
export type MoveClass = "aggressive" | "quiet" | "defensive";

export type TraceMove = {
  from: number;
  to: number;
  piece: PieceType;
  color: Color;
  captured: PieceType | null;
  promotion: boolean;
  /** Milliseconds the player spent. -1 when the clock was not theirs. */
  thinkMs: number;
};

export type Trace = {
  id: string;
  at: number;
  seat: Color;
  result: PlayerResult;
  moves: TraceMove[];
};

export type PlayerMoveFact = {
  phase: Phase;
  thinkMs: number;
  before: number;
  delta: number;
  class: MoveClass;
  accurate: boolean;
  instantCritical: boolean;
  inCheck: boolean;
};

export type BadSquare = { piece: string; square: string; moves: number };

export type GameWalk = {
  evals: number[];
  peak: number;
  floor: number;
  winning: boolean;
  worse: boolean;
  saved: boolean;
  moves: PlayerMoveFact[];
  heat: number[];
  bad: BadSquare[];
};

export type ColourRow = { name: string; games: number; wins: number };

export type InsightReport = {
  ready: boolean;
  kept: number;
  strategic: {
    score: number;
    tip: string;
    series: { id: string; label: string; evals: number[] }[];
    winningPositions: number;
    wonFromThere: number;
  };
  time: {
    score: number;
    tip: string;
    bars: Record<Phase, number | null>;
    flags: number;
    strip: boolean[];
  };
  positional: {
    score: number;
    tip: string;
    heat: number[];
    bad: BadSquare[];
    centre: number;
  };
  psychology: {
    score: number;
    tip: string;
    afterWin: number | null;
    afterLoss: number | null;
    saved: number;
  };
  choices: {
    score: number;
    tip: string;
    aggressive: number;
    quiet: number;
    defensive: number;
    colours: ColourRow[];
  };
};

const EMPTY_BARS: Record<Phase, number | null> = { opening: null, middlegame: null, endgame: null };

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function seatEval(pos: Position, seat: Color): number {
  const raw = staticEval(pos);
  return pos.turn === seat ? raw : -raw;
}

function manhattan(a: number, b: number): number {
  return Math.abs(fileOf(a) - fileOf(b)) + Math.abs(rankOf(a) - rankOf(b));
}

function rim(sq: number): boolean {
  const file = fileOf(sq);
  const rank = rankOf(sq);
  return file === 0 || file === 7 || rank === 0 || rank === 7;
}

function phaseOf(playerMoveIndex: number, board: Position["board"]): Phase {
  const mat = materialQuarters(board, "w") + materialQuarters(board, "b");
  if (mat <= ENDGAME_QUARTERS) return "endgame";
  if (playerMoveIndex < OPENING_MOVES) return "opening";
  return "middlegame";
}

function classify(pos: Position, move: Move, seat: Color): MoveClass {
  if (inCheck(pos) || isAttacked(pos.board, move.from, other(seat))) return "defensive";
  if (move.captured) return "aggressive";
  const enemy = kingSquare(pos.board, other(seat));
  if (enemy >= 0 && move.piece !== "K" && manhattan(move.to, enemy) < manhattan(move.from, enemy)) return "aggressive";
  return "quiet";
}

function asMove(move: TraceMove): Move {
  return {
    from: move.from,
    to: move.to,
    piece: move.piece,
    color: move.color,
    captured: move.captured,
    promotion: move.promotion,
  };
}

/** Replay one game from the seat the player actually took. */
export function walkGame(game: Trace): GameWalk | null {
  let pos = startPosition();
  const evals = [seatEval(pos, game.seat)];
  const moves: PlayerMoveFact[] = [];
  const heat = Array.from({ length: 64 }, () => 0);
  const badMap = new Map<string, BadSquare>();
  let stay = new Map<number, { key: string; plies: number }>();
  let playerIndex = 0;
  let peak = evals[0];
  let floor = evals[0];

  const mark = (current: Position, ply: number) => {
    const next = new Map<number, { key: string; plies: number }>();
    for (let sq = 0; sq < 64; sq++) {
      const piece = current.board[sq];
      if (!piece || piece.color !== game.seat) continue;
      heat[sq] += 1;
      const key = piece.type;
      const prev = stay.get(sq);
      const plies = prev && prev.key === key ? prev.plies + 1 : 1;
      next.set(sq, { key, plies });
      if (ply >= RIM_AFTER_PLY && plies >= RIM_STAY_PLIES && piece.type !== "K" && rim(sq)) {
        const id = `${piece.type}@${sq}`;
        const movesSpent = Math.floor(plies / 2);
        const prior = badMap.get(id);
        if (!prior || prior.moves < movesSpent) {
          badMap.set(id, { piece: PIECE_META[piece.type].name, square: coord(sq), moves: movesSpent });
        }
      }
    }
    stay = next;
  };

  mark(pos, 0);
  for (let ply = 0; ply < game.moves.length; ply++) {
    const trace = game.moves[ply];
    const move = asMove(trace);
    const legal = legalMoves(pos);
    const found = legal.find((item) => item.from === move.from && item.to === move.to && item.promotion === move.promotion);
    if (!found || outcome(pos).kind !== "ongoing") return null;
    const before = seatEval(pos, game.seat);
    const mine = found.color === game.seat;
    const kind = mine ? classify(pos, found, game.seat) : "quiet";
    const checked = mine && inCheck(pos);
    const index = playerIndex;
    const phase = phaseOf(index, pos.board);
    pos = applyMove(pos, found);
    const after = seatEval(pos, game.seat);
    evals.push(after);
    if (after > peak) peak = after;
    if (after < floor) floor = after;
    mark(pos, ply + 1);
    if (!mine) continue;
    const delta = after - before;
    const thinkMs = Number.isFinite(trace.thinkMs) ? trace.thinkMs : -1;
    moves.push({
      phase,
      thinkMs,
      before,
      delta,
      class: kind,
      accurate: delta >= -BLUNDER_CP,
      instantCritical: thinkMs >= 0 && thinkMs < INSTANT_MS && Math.abs(delta) >= SWING_CP,
      inCheck: checked,
    });
    playerIndex += 1;
  }

  const winning = peak >= WINNING_CP;
  const worse = floor <= -WORSE_CP;
  return {
    evals,
    peak,
    floor,
    winning,
    worse,
    saved: worse && (game.result === "win" || game.result === "draw"),
    moves,
    heat,
    bad: [...badMap.values()].sort((a, b) => b.moves - a.moves || a.square.localeCompare(b.square)),
  };
}

function share(part: number, whole: number): number {
  if (!whole) return 0;
  return part / whole;
}

function strategicTip(consistency: number, winning: number, won: number): string {
  if (winning > 0 && won / winning < 0.5) {
    return "You reached winning positions and let them go. When you are ahead, simplify and keep the Raja covered.";
  }
  if (consistency < 65) {
    return "Your edge jumps up and down. Finish one idea before you start the next.";
  }
  return "Your plans are holding. Keep answering threats before you look for a new attack.";
}

function timeTip(timed: number, flags: number): string {
  if (!timed) return "Think time starts with the next bot game, so this chart can fill in.";
  if (flags > 0) return "A few sharp moments were played instantly. Give those a breath before you move.";
  return "You are spending your time where the position changes. Keep that habit.";
}

function positionalTip(bad: number, centre: number): string {
  if (bad >= 3) return "Some pieces sit on the rim for a long time. Bring one of them toward the centre.";
  if (centre < 40) return "The centre is thin. A step toward the middle improves the Ratha and the Ashva.";
  return "Your pieces are finding useful squares, and the Raja is mostly left in peace.";
}

function psychologyTip(afterWin: number | null, afterLoss: number | null, saved: number): string {
  if (afterWin != null && afterLoss != null && afterLoss + 8 < afterWin) {
    return "After a loss the next game is looser. Start that one with a calm, ordinary move.";
  }
  if (saved > 0) return "You have saved games from worse positions. Stay in those; the Raja can still hold.";
  return "Results are not tilting the next game. Keep meeting the position in front of you.";
}

function choicesTip(aggressive: number, quiet: number, defensive: number, colours: ColourRow[]): string {
  const total = aggressive + quiet + defensive;
  const attack = share(aggressive, total);
  const defence = share(defensive, total);
  const used = colours.filter((row) => row.games > 0).length;
  if (attack > 0.55) return "You attack more often than you wait. A quiet move that improves a piece is often stronger.";
  if (defence > 0.5) return "A lot of moves are answers. Look for one improving move when you are not in check.";
  if (used < 2) return "You have only tried one set of pieces. The other set is the same army, from the other side.";
  return "Attack, quiet moves, and defence are all in your games. Keep choosing for the position.";
}

function blank(kept: number): InsightReport {
  return {
    ready: false,
    kept,
    strategic: { score: 0, tip: "", series: [], winningPositions: 0, wonFromThere: 0 },
    time: { score: 0, tip: "", bars: { ...EMPTY_BARS }, flags: 0, strip: [] },
    positional: { score: 0, tip: "", heat: Array.from({ length: 64 }, () => 0), bad: [], centre: 0 },
    psychology: { score: 0, tip: "", afterWin: null, afterLoss: null, saved: 0 },
    choices: {
      score: 0,
      tip: "",
      aggressive: 0,
      quiet: 0,
      defensive: 0,
      colours: [
        { name: "Light pieces", games: 0, wins: 0 },
        { name: "Dark pieces", games: 0, wins: 0 },
      ],
    },
  };
}

/** Scores and charts for the player's own decisions. Needs five readable games. */
export function analyze(games: Trace[]): InsightReport {
  const ordered = games
    .filter((game) => game && (game.seat === "w" || game.seat === "b") && Array.isArray(game.moves))
    .slice()
    .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const walks: { game: Trace; walk: GameWalk }[] = [];
  for (const game of ordered) {
    const walk = walkGame(game);
    if (walk) walks.push({ game, walk });
  }
  if (walks.length < INSIGHT_MIN_GAMES) return blank(walks.length);

  let dropSum = 0;
  let dropCount = 0;
  let threats = 0;
  let replies = 0;
  let winningPositions = 0;
  let wonFromThere = 0;
  const phaseSum: Record<Phase, { total: number; n: number }> = {
    opening: { total: 0, n: 0 },
    middlegame: { total: 0, n: 0 },
    endgame: { total: 0, n: 0 },
  };
  let timed = 0;
  let instant = 0;
  let critical = 0;
  let criticalCare = 0;
  let flags = 0;
  const strip: boolean[] = [];
  const heat = Array.from({ length: 64 }, () => 0);
  let centreHits = 0;
  let centreAll = 0;
  const bad = new Map<string, BadSquare>();
  let checked = 0;
  let accurate = 0;
  let playerMoves = 0;
  const classes = { aggressive: 0, quiet: 0, defensive: 0 };
  let saved = 0;
  let winAcc = 0;
  let winMoves = 0;
  let lossAcc = 0;
  let lossMoves = 0;
  const colours: ColourRow[] = [
    { name: "Light pieces", games: 0, wins: 0 },
    { name: "Dark pieces", games: 0, wins: 0 },
  ];

  walks.forEach(({ game, walk }, index) => {
    if (walk.winning) {
      winningPositions += 1;
      if (game.result === "win") wonFromThere += 1;
    }
    if (walk.saved) saved += 1;
    const row = colours[game.seat === "w" ? 0 : 1];
    row.games += 1;
    if (game.result === "win") row.wins += 1;
    for (let sq = 0; sq < 64; sq++) heat[sq] += walk.heat[sq];
    for (const item of walk.bad) {
      const id = `${item.piece}@${item.square}`;
      const prior = bad.get(id);
      if (!prior || prior.moves < item.moves) bad.set(id, item);
    }
    const prev = index > 0 ? walks[index - 1].game.result : null;
    for (const move of walk.moves) {
      playerMoves += 1;
      if (move.inCheck) checked += 1;
      if (move.accurate) accurate += 1;
      classes[move.class] += 1;
      dropSum += Math.max(0, -move.delta);
      dropCount += 1;
      if (move.before <= -THREAT_CP) {
        threats += 1;
        if (move.delta >= REPLY_CP) replies += 1;
      }
      if (move.thinkMs >= 0) {
        timed += 1;
        phaseSum[move.phase].total += move.thinkMs;
        phaseSum[move.phase].n += 1;
        if (move.thinkMs < INSTANT_MS) instant += 1;
      }
      if (Math.abs(move.delta) >= SWING_CP) {
        critical += 1;
        if (move.thinkMs >= INSTANT_MS) criticalCare += 1;
      }
      if (move.instantCritical) flags += 1;
      strip.push(move.instantCritical);
      if (prev === "win") {
        winMoves += 1;
        if (move.accurate) winAcc += 1;
      } else if (prev === "loss") {
        lossMoves += 1;
        if (move.accurate) lossAcc += 1;
      }
    }
  });

  // Centre and safety are read from the walks' heat and check-free accurate moves.
  // Recompute centre from the summed heatmap: central 16 squares are files 2-5, ranks 2-5.
  for (let sq = 0; sq < 64; sq++) {
    centreAll += heat[sq];
    const file = fileOf(sq);
    const rank = rankOf(sq);
    if (file >= 2 && file <= 5 && rank >= 2 && rank <= 5) centreHits += heat[sq];
  }
  const centre = centreAll ? Math.round((centreHits / centreAll) * 100) : 0;
  const consistency = clampScore(100 - (dropCount ? dropSum / dropCount : 0) / 8);
  const prophylaxis = threats ? clampScore((replies / threats) * 100) : 70;
  const conversion = winningPositions ? clampScore((wonFromThere / winningPositions) * 100) : 55;
  const strategicScore = clampScore(consistency * 0.4 + prophylaxis * 0.3 + conversion * 0.3);

  const bars: Record<Phase, number | null> = {
    opening: phaseSum.opening.n ? Math.round(phaseSum.opening.total / phaseSum.opening.n) : null,
    middlegame: phaseSum.middlegame.n ? Math.round(phaseSum.middlegame.total / phaseSum.middlegame.n) : null,
    endgame: phaseSum.endgame.n ? Math.round(phaseSum.endgame.total / phaseSum.endgame.n) : null,
  };
  const care = critical ? (criticalCare / critical) * 100 : 80;
  const calm = timed ? (1 - instant / timed) * 100 : 50;
  const timeScore = clampScore(care * 0.6 + calm * 0.4);

  const safety = playerMoves ? ((playerMoves - checked) / playerMoves) * 100 : 70;
  const improvement = clampScore(100 - bad.size * 12);
  const positionalScore = clampScore(safety * 0.4 + centre * 0.35 + improvement * 0.25);

  const afterWin = winMoves ? Math.round((winAcc / winMoves) * 100) : null;
  const afterLoss = lossMoves ? Math.round((lossAcc / lossMoves) * 100) : null;
  const accuracy = playerMoves ? (accurate / playerMoves) * 100 : 70;
  const worseGames = walks.filter((item) => item.walk.worse).length;
  const resilience = worseGames ? (saved / worseGames) * 100 : 60;
  const psychologyScore = clampScore((afterLoss ?? accuracy) * 0.35 + (afterWin ?? accuracy) * 0.25 + resilience * 0.4);

  const dominant = Math.max(classes.aggressive, classes.quiet, classes.defensive);
  const dominantShare = share(dominant, playerMoves);
  const choiceScore = clampScore(dominantShare <= 0.5 ? 80 + (0.5 - dominantShare) * 40 : 80 - (dominantShare - 0.5) * 140);

  return {
    ready: true,
    kept: walks.length,
    strategic: {
      score: strategicScore,
      tip: strategicTip(consistency, winningPositions, wonFromThere),
      series: walks.map((item, index) => ({
        id: item.game.id,
        label: `Game ${index + 1}`,
        evals: item.walk.evals,
      })),
      winningPositions,
      wonFromThere,
    },
    time: {
      score: timeScore,
      tip: timeTip(timed, flags),
      bars,
      flags,
      strip: strip.slice(-36),
    },
    positional: {
      score: positionalScore,
      tip: positionalTip(bad.size, centre),
      heat,
      bad: [...bad.values()].sort((a, b) => b.moves - a.moves || a.piece.localeCompare(b.piece)).slice(0, 6),
      centre,
    },
    psychology: {
      score: psychologyScore,
      tip: psychologyTip(afterWin, afterLoss, saved),
      afterWin,
      afterLoss,
      saved,
    },
    choices: {
      score: choiceScore,
      tip: choicesTip(classes.aggressive, classes.quiet, classes.defensive, colours),
      aggressive: classes.aggressive,
      quiet: classes.quiet,
      defensive: classes.defensive,
      colours,
    },
  };
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readRaw(): Trace[] {
  const bin = storage();
  if (!bin) return [];
  try {
    const data = JSON.parse(bin.getItem(INSIGHTS_KEY) || "") as { v?: number; games?: Trace[] };
    if (data.v !== 1 || !Array.isArray(data.games)) return [];
    return data.games.filter((game) => game && typeof game.id === "string" && Array.isArray(game.moves));
  } catch {
    return [];
  }
}

function writeRaw(games: Trace[]) {
  const bin = storage();
  if (!bin) return;
  try {
    bin.setItem(INSIGHTS_KEY, JSON.stringify({ v: 1, games: games.slice(0, MAX_GAMES) }));
  } catch {
    /* the page still works for this visit */
  }
}

export function loadInsights(): Trace[] {
  return readRaw();
}

export function archiveInsight(game: Trace) {
  if (!game.id || !game.moves.length) return;
  const games = readRaw().filter((item) => item.id !== game.id);
  games.unshift({
    id: game.id,
    at: game.at || Date.now(),
    seat: game.seat === "b" ? "b" : "w",
    result: game.result === "win" || game.result === "loss" || game.result === "draw" ? game.result : "draw",
    moves: game.moves.map((move) => ({
      from: move.from,
      to: move.to,
      piece: move.piece,
      color: move.color,
      captured: move.captured,
      promotion: Boolean(move.promotion),
      thinkMs: Number.isFinite(move.thinkMs) ? Math.round(move.thinkMs) : -1,
    })),
  });
  writeRaw(games);
}

export function forgetInsight(id: string) {
  writeRaw(readRaw().filter((game) => game.id !== id));
}

export function rememberThinks(thinks: number[]) {
  const bin = storage();
  if (!bin) return;
  try {
    bin.setItem(INSIGHT_CLOCKS_KEY, JSON.stringify({ v: 1, thinks: thinks.slice(-240) }));
  } catch {
    /* clocks for this game stay in memory */
  }
}

export function recallThinks(moveCount: number): number[] {
  const bin = storage();
  if (!bin) return [];
  try {
    const data = JSON.parse(bin.getItem(INSIGHT_CLOCKS_KEY) || "") as { v?: number; thinks?: unknown };
    if (data.v !== 1 || !Array.isArray(data.thinks)) return [];
    return data.thinks
      .slice(0, moveCount)
      .map((n) => (typeof n === "number" && Number.isFinite(n) ? n : -1));
  } catch {
    return [];
  }
}

export function clearThinks() {
  const bin = storage();
  if (!bin) return;
  try {
    bin.removeItem(INSIGHT_CLOCKS_KEY);
  } catch {
    /* nothing stored */
  }
}

export function insightStamp(games: Trace[]): string {
  const last = games[0];
  return `${games.length}:${last?.id ?? ""}:${last?.moves.length ?? 0}:${last?.result ?? ""}`;
}

export function readInsightCache(stamp: string): InsightReport | null {
  const bin = storage();
  if (!bin) return null;
  try {
    const data = JSON.parse(bin.getItem(INSIGHT_CACHE_KEY) || "") as { stamp?: string; report?: InsightReport };
    if (data.stamp !== stamp || !data.report) return null;
    return data.report;
  } catch {
    return null;
  }
}

export function writeInsightCache(stamp: string, report: InsightReport) {
  const bin = storage();
  if (!bin) return;
  try {
    bin.setItem(INSIGHT_CACHE_KEY, JSON.stringify({ stamp, report }));
  } catch {
    /* memory cache still holds it */
  }
}
