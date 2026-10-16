import { coord, fileOf, other, rankOf, type Color } from "./engine.ts";

/**
 * Challenge: Chess vs SATARANGA.
 *
 * Each side has its own rule set. Attacks are always judged by the piece that
 * is doing the attacking, so a chess queen can check a Raja and a leaping Gaja
 * can check a chess king. Classic SATARANGA games keep using engine.ts.
 */
export type RuleSet = "chess" | "sataranga";

export type CType = "K" | "Q" | "R" | "B" | "N" | "P" | "M" | "G" | "A";

export interface CPiece {
  color: Color;
  type: CType;
}

export interface CMove {
  from: number;
  to: number;
  piece: CType;
  color: Color;
  captured: CType | null;
  promotion: CType | null;
  castle: "K" | "Q" | null;
  ep: boolean;
}

export interface CastleRights {
  K: boolean;
  Q: boolean;
}

export interface ChallengeState {
  board: (CPiece | null)[];
  turn: Color;
  rules: Record<Color, RuleSet>;
  castle: Record<Color, CastleRights>;
  ep: number | null;
  halfmove: number;
  moves: CMove[];
  keys: string[];
}

export type ChallengeEnd =
  | { kind: "ongoing" }
  | { kind: "win"; winner: Color; reason: "checkmate" | "stalemate" | "bare_raja" | "time" }
  | { kind: "draw"; reason: "stalemate" | "mutual_bare" | "repetition" | "lone_kings" | "fifty" };

export interface SearchInfo {
  depth: number;
  nodes: number;
  ms: number;
}

/** One minute for each side. The classic clocks are not used. */
export const CHALLENGE_BULLET_MS = 60_000;
/** Soft cap so a move stays inside a bullet game. Depth 1 always finishes. */
export const CHALLENGE_MOVE_MS = 200;
export const CHALLENGE_MAX_DEPTH = 5;

const CHESS_PROMO: CType[] = ["Q", "R", "B", "N"];
const ORTH: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const DIAG: ReadonlyArray<readonly [number, number]> = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KING_STEPS: ReadonlyArray<readonly [number, number]> = [...ORTH, ...DIAG];
const KNIGHT: ReadonlyArray<readonly [number, number]> = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

export function valueOf(type: CType): number {
  switch (type) {
    case "Q":
      return 900;
    case "R":
      return 500;
    case "B":
      return 350;
    case "A":
      return 340;
    case "N":
      return 320;
    case "M":
      return 210;
    case "G":
      return 180;
    case "P":
      return 100;
    default:
      return 0;
  }
}

function onBoard(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

export function findKing(board: (CPiece | null)[], color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === "K") return i;
  }
  return -1;
}

function count(board: (CPiece | null)[], color: Color): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (board[i]?.color === color) n++;
  return n;
}

function positionKey(state: ChallengeState): string {
  const c = state.castle;
  let s = state.turn;
  s += state.rules.w === "chess" ? "C" : "S";
  s += state.rules.b === "chess" ? "C" : "S";
  s += c.w.K ? "K" : "";
  s += c.w.Q ? "Q" : "";
  s += c.b.K ? "k" : "";
  s += c.b.Q ? "q" : "";
  s += state.ep == null ? "-" : coord(state.ep);
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    s += p ? p.color + p.type : ".";
  }
  return s;
}

export function makeChallenge(
  board: (CPiece | null)[],
  turn: Color,
  rules: Record<Color, RuleSet> = { w: "chess", b: "sataranga" },
  extra?: { castle?: Record<Color, CastleRights>; ep?: number | null; halfmove?: number },
): ChallengeState {
  const state: ChallengeState = {
    board: board.slice(),
    turn,
    rules,
    castle: extra?.castle ?? {
      w: { K: rules.w === "chess", Q: rules.w === "chess" },
      b: { K: rules.b === "chess", Q: rules.b === "chess" },
    },
    ep: extra?.ep ?? null,
    halfmove: extra?.halfmove ?? 0,
    moves: [],
    keys: [],
  };
  state.keys = [positionKey(state)];
  return state;
}

/** Human plays White with a chess army. The bot plays Black with a SATARANGA army. */
export function challengeStart(): ChallengeState {
  const board: (CPiece | null)[] = Array.from({ length: 64 }, () => null);
  const white: CType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  const black: CType[] = ["R", "A", "G", "K", "M", "G", "A", "R"];
  for (let f = 0; f < 8; f++) {
    board[f] = { color: "w", type: white[f] };
    board[8 + f] = { color: "w", type: "P" };
    board[48 + f] = { color: "b", type: "P" };
    board[56 + f] = { color: "b", type: black[f] };
  }
  return makeChallenge(board, "w", { w: "chess", b: "sataranga" });
}

/** A square is attacked when an enemy piece can capture it under that piece's own movement. */
export function challengeAttacks(board: (CPiece | null)[], target: number, by: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);
  const pr = tr + (by === "w" ? -1 : 1);
  for (const df of [-1, 1]) {
    const f = tf + df;
    if (!onBoard(f, pr)) continue;
    const p = board[pr * 8 + f];
    if (p && p.color === by && p.type === "P") return true;
  }
  for (const [df, dr] of DIAG) {
    const f = tf + df;
    const r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[r * 8 + f];
    if (p && p.color === by && (p.type === "K" || p.type === "M")) return true;
  }
  for (const [df, dr] of ORTH) {
    const f = tf + df;
    const r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[r * 8 + f];
    if (p && p.color === by && p.type === "K") return true;
  }
  for (const [df, dr] of DIAG) {
    const f = tf + df * 2;
    const r = tr + dr * 2;
    if (!onBoard(f, r)) continue;
    const p = board[r * 8 + f];
    if (p && p.color === by && p.type === "G") return true;
  }
  for (const [df, dr] of KNIGHT) {
    const f = tf + df;
    const r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[r * 8 + f];
    if (p && p.color === by && (p.type === "N" || p.type === "A")) return true;
  }
  for (const [df, dr] of DIAG) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      const p = board[r * 8 + f];
      if (p) {
        if (p.color === by && (p.type === "B" || p.type === "Q")) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  for (const [df, dr] of ORTH) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      const p = board[r * 8 + f];
      if (p) {
        if (p.color === by && (p.type === "R" || p.type === "Q")) return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  return false;
}

export function challengeInCheck(state: ChallengeState): boolean {
  const king = findKing(state.board, state.turn);
  if (king < 0) return true;
  return challengeAttacks(state.board, king, other(state.turn));
}

function pushMove(
  out: CMove[],
  board: (CPiece | null)[],
  from: number,
  to: number,
  piece: CPiece,
  promotion: CType | null,
  castle: "K" | "Q" | null,
  ep: boolean,
  captured: CType | null,
) {
  if (!ep && captured == null) {
    const target = board[to];
    captured = target && target.color !== piece.color ? target.type : null;
  }
  out.push({
    from,
    to,
    piece: piece.type,
    color: piece.color,
    captured,
    promotion,
    castle,
    ep,
  });
}

function pushPromo(out: CMove[], board: (CPiece | null)[], from: number, to: number, piece: CPiece, chess: boolean) {
  const choices = chess ? CHESS_PROMO : (["M"] as CType[]);
  for (const promotion of choices) pushMove(out, board, from, to, piece, promotion, null, false, null);
}

function genPawn(state: ChallengeState, sq: number, piece: CPiece, out: CMove[]) {
  const chess = state.rules[piece.color] === "chess";
  const dir = piece.color === "w" ? 1 : -1;
  const f = fileOf(sq);
  const r = rankOf(sq);
  const r2 = r + dir;
  if (!onBoard(f, r2)) return;
  const promo = r2 === (piece.color === "w" ? 7 : 0);
  const ahead = r2 * 8 + f;
  if (!state.board[ahead]) {
    if (promo) pushPromo(out, state.board, sq, ahead, piece, chess);
    else pushMove(out, state.board, sq, ahead, piece, null, null, false, null);
    const start = piece.color === "w" ? 1 : 6;
    const r3 = r + dir * 2;
    if (chess && r === start && onBoard(f, r3) && !state.board[r3 * 8 + f]) {
      pushMove(out, state.board, sq, r3 * 8 + f, piece, null, null, false, null);
    }
  }
  for (const df of [-1, 1]) {
    const f2 = f + df;
    if (!onBoard(f2, r2)) continue;
    const cap = r2 * 8 + f2;
    const target = state.board[cap];
    if (target && target.color !== piece.color) {
      if (promo) pushPromo(out, state.board, sq, cap, piece, chess);
      else pushMove(out, state.board, sq, cap, piece, null, null, false, target.type);
    }
  }
  if (chess && state.ep != null && rankOf(state.ep) === r2 && Math.abs(fileOf(state.ep) - f) === 1) {
    pushMove(out, state.board, sq, state.ep, piece, null, null, true, "P");
  }
}

function genLeaps(board: (CPiece | null)[], sq: number, piece: CPiece, steps: ReadonlyArray<readonly [number, number]>, out: CMove[]) {
  const f = fileOf(sq);
  const r = rankOf(sq);
  for (const [df, dr] of steps) {
    const f2 = f + df;
    const r2 = r + dr;
    if (!onBoard(f2, r2)) continue;
    const to = r2 * 8 + f2;
    const target = board[to];
    if (!target || target.color !== piece.color) pushMove(out, board, sq, to, piece, null, null, false, null);
  }
}

function genSlides(board: (CPiece | null)[], sq: number, piece: CPiece, dirs: ReadonlyArray<readonly [number, number]>, out: CMove[]) {
  const f0 = fileOf(sq);
  const r0 = rankOf(sq);
  for (const [df, dr] of dirs) {
    let f = f0 + df;
    let r = r0 + dr;
    while (onBoard(f, r)) {
      const to = r * 8 + f;
      const target = board[to];
      if (!target) pushMove(out, board, sq, to, piece, null, null, false, null);
      else {
        if (target.color !== piece.color) pushMove(out, board, sq, to, piece, null, null, false, target.type);
        break;
      }
      f += df;
      r += dr;
    }
  }
}

function canCastle(state: ChallengeState, color: Color, side: "K" | "Q"): boolean {
  if (state.rules[color] !== "chess" || !state.castle[color][side]) return false;
  const rank = color === "w" ? 0 : 7;
  const kingFrom = rank * 8 + 4;
  const king = state.board[kingFrom];
  if (!king || king.color !== color || king.type !== "K") return false;
  const rookSq = rank * 8 + (side === "K" ? 7 : 0);
  const rook = state.board[rookSq];
  if (!rook || rook.color !== color || rook.type !== "R") return false;
  const empty = side === "K" ? [5, 6] : [1, 2, 3];
  for (const f of empty) if (state.board[rank * 8 + f]) return false;
  const opp = other(color);
  if (challengeAttacks(state.board, kingFrom, opp)) return false;
  const passed = side === "K" ? [5, 6] : [2, 3];
  for (const f of passed) if (challengeAttacks(state.board, rank * 8 + f, opp)) return false;
  return true;
}

function pseudo(state: ChallengeState, color: Color): CMove[] {
  const out: CMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = state.board[sq];
    if (!piece || piece.color !== color) continue;
    if (piece.type === "P") genPawn(state, sq, piece, out);
    else if (piece.type === "N" || piece.type === "A") genLeaps(state.board, sq, piece, KNIGHT, out);
    else if (piece.type === "G") genLeaps(state.board, sq, piece, DIAG.map(([df, dr]) => [df * 2, dr * 2] as const), out);
    else if (piece.type === "M") genLeaps(state.board, sq, piece, DIAG, out);
    else if (piece.type === "B") genSlides(state.board, sq, piece, DIAG, out);
    else if (piece.type === "R") genSlides(state.board, sq, piece, ORTH, out);
    else if (piece.type === "Q") genSlides(state.board, sq, piece, KING_STEPS, out);
    else if (piece.type === "K") {
      genLeaps(state.board, sq, piece, KING_STEPS, out);
      if (canCastle(state, color, "K")) pushMove(out, state.board, sq, rankOf(sq) * 8 + 6, piece, null, "K", false, null);
      if (canCastle(state, color, "Q")) pushMove(out, state.board, sq, rankOf(sq) * 8 + 2, piece, null, "Q", false, null);
    }
  }
  return out;
}

export function applyChallenge(state: ChallengeState, move: CMove): ChallengeState {
  const board = state.board.slice();
  board[move.from] = null;
  if (move.ep) board[rankOf(move.from) * 8 + fileOf(move.to)] = null;
  board[move.to] = { color: move.color, type: move.promotion ?? move.piece };
  if (move.castle === "K") {
    const rank = rankOf(move.to);
    board[rank * 8 + 5] = board[rank * 8 + 7];
    board[rank * 8 + 7] = null;
  } else if (move.castle === "Q") {
    const rank = rankOf(move.to);
    board[rank * 8 + 3] = board[rank * 8];
    board[rank * 8] = null;
  }
  const castle: Record<Color, CastleRights> = {
    w: { ...state.castle.w },
    b: { ...state.castle.b },
  };
  if (move.piece === "K" || move.castle) castle[move.color] = { K: false, Q: false };
  const clearRook = (sq: number) => {
    if (sq === 0) castle.w.Q = false;
    else if (sq === 7) castle.w.K = false;
    else if (sq === 56) castle.b.Q = false;
    else if (sq === 63) castle.b.K = false;
  };
  if (move.piece === "R") clearRook(move.from);
  clearRook(move.to);
  let ep: number | null = null;
  if (move.piece === "P" && state.rules[move.color] === "chess" && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    ep = (move.from + move.to) >> 1;
  }
  const next: ChallengeState = {
    board,
    turn: other(move.color),
    rules: state.rules,
    castle,
    ep,
    halfmove: move.piece === "P" || move.captured || move.ep ? 0 : state.halfmove + 1,
    moves: [...state.moves, move],
    keys: [],
  };
  next.keys = [...state.keys, positionKey(next)];
  return next;
}

function leavesKingSafe(state: ChallengeState, move: CMove): boolean {
  const next = applyChallenge(state, move);
  const king = findKing(next.board, move.color);
  if (king < 0) return false;
  return !challengeAttacks(next.board, king, other(move.color));
}

export function challengeLegal(state: ChallengeState): CMove[] {
  return pseudo(state, state.turn).filter((move) => leavesKingSafe(state, move));
}

function finishOutcome(state: ChallengeState, moves: CMove[]): ChallengeEnd {
  const side = state.turn;
  const opp = other(side);
  if (findKing(state.board, side) < 0) return { kind: "win", winner: opp, reason: "checkmate" };
  if (findKing(state.board, opp) < 0) return { kind: "win", winner: side, reason: "checkmate" };

  const mine = count(state.board, side);
  const theirs = count(state.board, opp);
  if (mine === 1 && theirs === 1 && findKing(state.board, side) >= 0 && findKing(state.board, opp) >= 0) {
    return { kind: "draw", reason: "lone_kings" };
  }

  const bare = (["w", "b"] as const).find(
    (color) => state.rules[color] === "sataranga" && count(state.board, color) === 1 && findKing(state.board, color) >= 0,
  );
  if (bare) {
    const strong = other(bare);
    if (count(state.board, strong) >= 2) {
      if (side === bare) {
        for (const move of moves) {
          if (count(applyChallenge(state, move).board, strong) === 1) return { kind: "draw", reason: "mutual_bare" };
        }
        return { kind: "win", winner: strong, reason: "bare_raja" };
      }
      return { kind: "win", winner: strong, reason: "bare_raja" };
    }
  }

  if (moves.length === 0) {
    if (challengeInCheck(state)) return { kind: "win", winner: opp, reason: "checkmate" };
    if (state.rules[side] === "chess") return { kind: "draw", reason: "stalemate" };
    return { kind: "win", winner: opp, reason: "stalemate" };
  }

  const now = state.keys[state.keys.length - 1];
  let seen = 0;
  for (const key of state.keys) if (key === now) seen++;
  if (seen >= 3) return { kind: "draw", reason: "repetition" };
  if (state.halfmove >= 100) return { kind: "draw", reason: "fifty" };
  return { kind: "ongoing" };
}

export function challengeOutcome(state: ChallengeState): ChallengeEnd {
  return finishOutcome(state, challengeLegal(state));
}

function sliderWeight(type: CType, xray: boolean): number {
  if (type === "Q") return xray ? 170 : 160;
  if (type === "B") return xray ? 120 : 110;
  return xray ? 90 : 80;
}

function aims(piece: CPiece, df: number, dr: number): boolean {
  const orth = df === 0 || dr === 0;
  const diag = df !== 0 && dr !== 0;
  if (piece.type === "Q") return true;
  if (piece.type === "R") return orth;
  if (piece.type === "B") return diag;
  return false;
}

/** Long-range lines aimed at this king: open rays, and rays with a single shield. */
function lineExposure(state: ChallengeState, king: number, color: Color): number {
  let danger = 0;
  const kf = fileOf(king);
  const kr = rankOf(king);
  for (const [df, dr] of KING_STEPS) {
    let f = kf + df;
    let r = kr + dr;
    let shield = false;
    let empties = 0;
    while (onBoard(f, r)) {
      const piece = state.board[r * 8 + f];
      if (!piece) {
        if (!shield) empties++;
        f += df;
        r += dr;
        continue;
      }
      if (!shield) {
        if (piece.color !== color && aims(piece, df, dr)) danger += sliderWeight(piece.type, false) + (empties === 0 ? 40 : 0);
        else if (piece.color === color) {
          shield = true;
          f += df;
          r += dr;
          continue;
        }
        break;
      }
      if (piece.color !== color && aims(piece, df, dr)) danger += sliderWeight(piece.type, true);
      break;
    }
  }
  return danger;
}

/**
 * Higher is safer. King safety is scored ahead of small material: an open line
 * to a queen, a missing shield, or a mating net outweighs a pawn.
 */
export function kingSafety(state: ChallengeState, color: Color): number {
  const king = findKing(state.board, color);
  if (king < 0) return -8000;
  const opp = other(color);
  let danger = 0;
  if (challengeAttacks(state.board, king, opp)) danger += 320;

  let flights = 0;
  let ring = 0;
  let guards = 0;
  let mantri = false;
  const kf = fileOf(king);
  const kr = rankOf(king);
  for (const [df, dr] of KING_STEPS) {
    const f = kf + df;
    const r = kr + dr;
    if (!onBoard(f, r)) continue;
    const sq = r * 8 + f;
    const occ = state.board[sq];
    const hit = challengeAttacks(state.board, sq, opp);
    if (hit) ring++;
    if (occ && occ.color === color) {
      guards++;
      if (occ.type === "M") mantri = true;
    } else if (!hit) flights++;
  }
  danger += ring * 24;
  if (flights < 3) danger += (3 - flights) * 32;
  if (flights <= 1 && ring >= 2) danger += 220;

  const dir = color === "w" ? 1 : -1;
  for (const df of [-1, 0, 1]) {
    const f = kf + df;
    const r1 = kr + dir;
    if (!onBoard(f, r1)) continue;
    const near = state.board[r1 * 8 + f];
    if (near && near.color === color && near.type === "P") danger -= 18;
    const r2 = kr + dir * 2;
    if (!onBoard(f, r2)) continue;
    const far = state.board[r2 * 8 + f];
    if (far && far.color === color && far.type === "P") danger -= 8;
  }
  if (mantri) danger -= 56;
  danger -= guards * 12;

  const fromHome = color === "w" ? kr : 7 - kr;
  if (fromHome >= 2) danger += 28 * (fromHome - 1);
  if (Math.abs(kf - 3.5) < 2 && fromHome >= 2) danger += 36;
  danger += lineExposure(state, king, color);
  if (danger > 260) danger = Math.round(danger * 1.45);
  return 80 - danger;
}

function placeValue(piece: CPiece, sq: number): number {
  const file = fileOf(sq);
  const rank = rankOf(sq);
  const forward = piece.color === "w" ? rank : 7 - rank;
  const center = 4 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5));
  if (piece.type === "P") return forward * 2;
  if (piece.type === "N" || piece.type === "A" || piece.type === "M" || piece.type === "G") return center * 2;
  return 0;
}

function evaluate(state: ChallengeState): number {
  let score = kingSafety(state, state.turn) - kingSafety(state, other(state.turn));
  for (let i = 0; i < 64; i++) {
    const piece = state.board[i];
    if (!piece) continue;
    const sign = piece.color === state.turn ? 1 : -1;
    score += sign * (valueOf(piece.type) + placeValue(piece, i));
  }
  return score;
}

function moveOrder(move: CMove): number {
  let score = 0;
  if (move.captured) score += 1000 + valueOf(move.captured) * 10 - valueOf(move.piece);
  if (move.promotion) score += valueOf(move.promotion);
  if (move.castle) score += 40;
  return score;
}

function ordered(moves: CMove[], first?: CMove | null): CMove[] {
  return moves.slice().sort((a, b) => {
    const ah = first && a.from === first.from && a.to === first.to && a.promotion === first.promotion ? 1_000_000 : 0;
    const bh = first && b.from === first.from && b.to === first.to && b.promotion === first.promotion ? 1_000_000 : 0;
    return bh + moveOrder(b) - (ah + moveOrder(a));
  });
}

function mateScore(winner: Color, turn: Color, ply: number): number {
  return winner === turn ? 100000 - ply : ply - 100000;
}

type Budget = { n: number; max: number; deadline: number };

function qsearch(state: ChallengeState, alpha: number, beta: number, ply: number, budget: Budget): number {
  if (budget.n++ > budget.max || Date.now() > budget.deadline || ply > 6) return evaluate(state);
  const moves = challengeLegal(state);
  const end = finishOutcome(state, moves);
  if (end.kind === "draw") return 0;
  if (end.kind === "win") return mateScore(end.winner, state.turn, ply);
  const checking = challengeInCheck(state);
  if (!checking) {
    const stand = evaluate(state);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
  }
  const considered = checking ? moves : moves.filter((move) => move.captured || move.promotion);
  for (const move of ordered(considered)) {
    const value = -qsearch(applyChallenge(state, move), -beta, -alpha, ply + 1, budget);
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return alpha;
}

function negamax(state: ChallengeState, depth: number, alpha: number, beta: number, ply: number, budget: Budget): number {
  if (budget.n++ > budget.max || Date.now() > budget.deadline) return evaluate(state);
  const moves = challengeLegal(state);
  const end = finishOutcome(state, moves);
  if (end.kind === "draw") return 0;
  if (end.kind === "win") return mateScore(end.winner, state.turn, ply);
  if (depth <= 0) return qsearch(state, alpha, beta, ply, budget);
  let best = -Infinity;
  for (const move of ordered(moves)) {
    const value = -negamax(applyChallenge(state, move), depth - 1, -beta, -alpha, ply + 1, budget);
    if (value > best) best = value;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluate(state) : best;
}

let lastInfo: SearchInfo = { depth: 0, nodes: 0, ms: 0 };

export function lastChallengeSearch(): SearchInfo {
  return lastInfo;
}

export function pickChallengeMove(
  state: ChallengeState,
  opts?: { ms?: number; nodes?: number; maxDepth?: number; noise?: number },
): CMove | null {
  const legal = challengeLegal(state);
  if (!legal.length || challengeOutcome(state).kind !== "ongoing") return legal[0] ?? null;
  if (legal.length === 1) {
    lastInfo = { depth: 0, nodes: 0, ms: 0 };
    return legal[0];
  }
  const ms = opts?.ms ?? CHALLENGE_MOVE_MS;
  const started = Date.now();
  const budget: Budget = {
    n: 0,
    max: opts?.nodes ?? 40_000,
    deadline: started + ms,
  };
  const ranked = ordered(legal);
  let best = ranked[0];
  let bestScored: { move: CMove; value: number }[] = [];
  let depthReached = 0;
  const maxDepth = opts?.maxDepth ?? CHALLENGE_MAX_DEPTH;
  for (let depth = 1; depth <= maxDepth; depth++) {
    if (depth > 1 && Date.now() > budget.deadline) break;
    const line = ordered(legal, best);
    const scored: { move: CMove; value: number }[] = [];
    let alpha = -Infinity;
    let finished = true;
    for (const move of line) {
      if (depth > 1 && Date.now() > budget.deadline && scored.length > 0) {
        finished = false;
        break;
      }
      const value = -negamax(applyChallenge(state, move), depth - 1, -Infinity, -alpha, 1, budget);
      scored.push({ move, value });
      if (value > alpha) alpha = value;
    }
    if (scored.length === 0) break;
    if (finished || depth === 1) {
      depthReached = depth;
      bestScored = scored;
      best = scored.reduce((top, row) => (row.value > top.value ? row : top)).move;
    }
    if (!finished) break;
  }
  const elapsed = Date.now() - started;
  lastInfo = { depth: depthReached, nodes: budget.n, ms: elapsed };
  const noise = opts?.noise ?? 0;
  if (noise > 0 && bestScored.length > 1) {
    const top = Math.max(...bestScored.map((row) => row.value));
    const pool = bestScored.filter((row) => row.value >= top - noise);
    return pool[Math.floor(Math.random() * pool.length)]?.move ?? best;
  }
  return best;
}

export const CHALLENGE_RECORD_KEY = "sataranga-challenge-v1";

export interface ChallengeRecord {
  v: 1;
  wins: number;
  losses: number;
  draws: number;
}

const EMPTY_RECORD: ChallengeRecord = { v: 1, wins: 0, losses: 0, draws: 0 };

function whole(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

export function loadChallengeRecord(): ChallengeRecord {
  if (typeof localStorage === "undefined") return { ...EMPTY_RECORD };
  try {
    const data = JSON.parse(localStorage.getItem(CHALLENGE_RECORD_KEY) || "") as Partial<ChallengeRecord>;
    if (data.v !== 1) return { ...EMPTY_RECORD };
    return { v: 1, wins: whole(data.wins), losses: whole(data.losses), draws: whole(data.draws) };
  } catch {
    return { ...EMPTY_RECORD };
  }
}

export function saveChallengeResult(result: "win" | "loss" | "draw"): ChallengeRecord {
  const current = loadChallengeRecord();
  const next: ChallengeRecord = {
    v: 1,
    wins: current.wins + (result === "win" ? 1 : 0),
    losses: current.losses + (result === "loss" ? 1 : 0),
    draws: current.draws + (result === "draw" ? 1 : 0),
  };
  try {
    localStorage.setItem(CHALLENGE_RECORD_KEY, JSON.stringify(next));
  } catch {
    /* the duel still ends on screen */
  }
  return next;
}

export function pieceName(piece: CPiece): string {
  switch (piece.type) {
    case "Q":
      return "Queen";
    case "B":
      return "Bishop";
    case "N":
      return "Knight";
    case "M":
      return "Mantri";
    case "G":
      return "Gaja";
    case "A":
      return "Ashva";
    case "K":
      return piece.color === "w" ? "King" : "Raja";
    case "R":
      return piece.color === "w" ? "Rook" : "Ratha";
    default:
      return piece.color === "w" ? "Pawn" : "Hewa";
  }
}
