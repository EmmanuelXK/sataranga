export type Color = "w" | "b";
export type PieceType = "K" | "M" | "G" | "R" | "A" | "P";

export interface Piece {
  color: Color;
  type: PieceType;
}

export interface Move {
  from: number;
  to: number;
  piece: PieceType;
  color: Color;
  captured: PieceType | null;
  promotion: boolean;
}

export interface Position {
  board: (Piece | null)[];
  turn: Color;
  moves: Move[];
  keys: string[];
}

export type End =
  | { kind: "ongoing" }
  | {
      kind: "win";
      winner: Color;
      reason: "checkmate" | "stalemate" | "bare_raja" | "resign" | "time";
    }
  | { kind: "draw"; reason: "mutual_bare" | "repetition" | "lone_kings" };

export const PIECE_META: Record<
  PieceType,
  { name: string; aka: string; blurb: string }
> = {
  K: {
    name: "Raja",
    aka: "King",
    blurb: "One square in any direction. The Raja may not step into attack. There is no castling.",
  },
  M: {
    name: "Mantri",
    aka: "Counselor",
    blurb:
      "One square diagonally only — not a sliding bishop. This is the piece a Padati promotes to.",
  },
  G: {
    name: "Gaja",
    aka: "Elephant",
    blurb:
      "Jumps exactly two squares diagonally. It leaps over anything in between and cannot be blocked.",
  },
  A: {
    name: "Ashva",
    aka: "Horse",
    blurb: "Jumps in an L: two squares one way, then one to the side. Same as the chess knight.",
  },
  R: {
    name: "Ratha",
    aka: "Chariot",
    blurb: "Slides any number of free squares along a rank or file. Same as the rook. No castling.",
  },
  P: {
    name: "Padati",
    aka: "Foot-soldier",
    blurb:
      "One square forward. Captures one square diagonally forward. No double step, no en passant. Promotes to Mantri.",
  },
};

/** Quarters of a pawn, matching classical mobility: R 5, A 3½, M 2, G 1¾, P 1. */
export const MATERIAL: Record<PieceType, number> = {
  P: 4,
  G: 7,
  M: 8,
  A: 14,
  R: 20,
  K: 0,
};

const MAT: Record<PieceType, number> = {
  P: 100,
  G: 175,
  M: 200,
  A: 350,
  R: 500,
  K: 0,
};

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

export function other(c: Color): Color {
  return c === "w" ? "b" : "w";
}

export function fileOf(sq: number): number {
  return sq & 7;
}
export function rankOf(sq: number): number {
  return sq >> 3;
}
export function coord(sq: number): string {
  return "abcdefgh"[fileOf(sq)] + String(rankOf(sq) + 1);
}

function positionKey(board: (Piece | null)[], turn: Color): string {
  let s = turn;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    s += p ? p.color + p.type : ".";
  }
  return s;
}

export function makePosition(board: (Piece | null)[], turn: Color, moves: Move[] = []): Position {
  const nextBoard = board.slice();
  return {
    board: nextBoard,
    turn,
    moves: moves.slice(),
    keys: [positionKey(nextBoard, turn)],
  };
}

export function startPosition(): Position {
  const board: (Piece | null)[] = Array.from({ length: 64 }, () => null);
  const back: PieceType[] = ["R", "A", "G", "K", "M", "G", "A", "R"];
  for (let f = 0; f < 8; f++) {
    board[f] = { color: "w", type: back[f] };
    board[8 + f] = { color: "w", type: "P" };
    board[48 + f] = { color: "b", type: "P" };
    board[56 + f] = { color: "b", type: back[f] };
  }
  return makePosition(board, "w");
}

function onBoard(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

export function kingSquare(board: (Piece | null)[], color: Color): number {
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (p && p.color === color && p.type === "K") return i;
  }
  return -1;
}

export function isAttacked(board: (Piece | null)[], target: number, by: Color): boolean {
  const tf = fileOf(target);
  const tr = rankOf(target);

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
    if (p && p.color === by && p.type === "A") return true;
  }
  for (const [df, dr] of ORTH) {
    let f = tf + df;
    let r = tr + dr;
    while (onBoard(f, r)) {
      const p = board[r * 8 + f];
      if (p) {
        if (p.color === by && p.type === "R") return true;
        break;
      }
      f += df;
      r += dr;
    }
  }
  if (by === "w") {
    for (const df of [-1, 1]) {
      const f = tf + df;
      const r = tr - 1;
      if (!onBoard(f, r)) continue;
      const p = board[r * 8 + f];
      if (p && p.color === "w" && p.type === "P") return true;
    }
  } else {
    for (const df of [-1, 1]) {
      const f = tf + df;
      const r = tr + 1;
      if (!onBoard(f, r)) continue;
      const p = board[r * 8 + f];
      if (p && p.color === "b" && p.type === "P") return true;
    }
  }
  return false;
}

function pushMove(
  out: Move[],
  board: (Piece | null)[],
  from: number,
  to: number,
  piece: Piece,
  promotion: boolean,
) {
  const target = board[to];
  out.push({
    from,
    to,
    piece: piece.type,
    color: piece.color,
    captured: target ? target.type : null,
    promotion,
  });
}

function pseudo(board: (Piece | null)[], color: Color): Move[] {
  const out: Move[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const piece = board[sq];
    if (!piece || piece.color !== color) continue;
    const f = fileOf(sq);
    const r = rankOf(sq);
    if (piece.type === "P") {
      const dir = color === "w" ? 1 : -1;
      const promo = color === "w" ? 7 : 0;
      const r2 = r + dir;
      if (onBoard(f, r2)) {
        const ahead = r2 * 8 + f;
        if (!board[ahead]) pushMove(out, board, sq, ahead, piece, r2 === promo);
        for (const df of [-1, 1]) {
          const f2 = f + df;
          if (!onBoard(f2, r2)) continue;
          const cap = r2 * 8 + f2;
          const t = board[cap];
          if (t && t.color !== color) pushMove(out, board, sq, cap, piece, r2 === promo);
        }
      }
    } else if (piece.type === "A") {
      for (const [df, dr] of KNIGHT) {
        const f2 = f + df;
        const r2 = r + dr;
        if (!onBoard(f2, r2)) continue;
        const to = r2 * 8 + f2;
        const t = board[to];
        if (!t || t.color !== color) pushMove(out, board, sq, to, piece, false);
      }
    } else if (piece.type === "G") {
      for (const [df, dr] of DIAG) {
        const f2 = f + df * 2;
        const r2 = r + dr * 2;
        if (!onBoard(f2, r2)) continue;
        const to = r2 * 8 + f2;
        const t = board[to];
        if (!t || t.color !== color) pushMove(out, board, sq, to, piece, false);
      }
    } else if (piece.type === "M") {
      for (const [df, dr] of DIAG) {
        const f2 = f + df;
        const r2 = r + dr;
        if (!onBoard(f2, r2)) continue;
        const to = r2 * 8 + f2;
        const t = board[to];
        if (!t || t.color !== color) pushMove(out, board, sq, to, piece, false);
      }
    } else if (piece.type === "K") {
      for (const [df, dr] of [...ORTH, ...DIAG]) {
        const f2 = f + df;
        const r2 = r + dr;
        if (!onBoard(f2, r2)) continue;
        const to = r2 * 8 + f2;
        const t = board[to];
        if (!t || t.color !== color) pushMove(out, board, sq, to, piece, false);
      }
    } else {
      for (const [df, dr] of ORTH) {
        let f2 = f + df;
        let r2 = r + dr;
        while (onBoard(f2, r2)) {
          const to = r2 * 8 + f2;
          const t = board[to];
          if (!t) pushMove(out, board, sq, to, piece, false);
          else {
            if (t.color !== color) pushMove(out, board, sq, to, piece, false);
            break;
          }
          f2 += df;
          r2 += dr;
        }
      }
    }
  }
  return out;
}

export function applyMove(pos: Position, move: Move): Position {
  const board = pos.board.slice();
  board[move.from] = null;
  board[move.to] = {
    color: move.color,
    type: move.promotion ? "M" : move.piece,
  };
  const turn = other(move.color);
  const moves = [...pos.moves, move];
  const keys = [...pos.keys, positionKey(board, turn)];
  return { board, turn, moves, keys };
}

function safeForMover(pos: Position, move: Move): boolean {
  const next = applyMove(pos, move);
  const k = kingSquare(next.board, move.color);
  if (k < 0) return false;
  return !isAttacked(next.board, k, other(move.color));
}

export function legalMoves(pos: Position): Move[] {
  return pseudo(pos.board, pos.turn).filter((m) => safeForMover(pos, m));
}

export function inCheck(pos: Position): boolean {
  const k = kingSquare(pos.board, pos.turn);
  if (k < 0) return true;
  return isAttacked(pos.board, k, other(pos.turn));
}

function countColor(board: (Piece | null)[], color: Color): number {
  let n = 0;
  for (let i = 0; i < 64; i++) if (board[i]?.color === color) n++;
  return n;
}

function onlyRaja(board: (Piece | null)[], color: Color): boolean {
  return countColor(board, color) === 1 && kingSquare(board, color) >= 0;
}

export function outcome(pos: Position): End {
  const side = pos.turn;
  const opp = other(side);
  const mine = countColor(pos.board, side);
  const theirs = countColor(pos.board, opp);

  if (mine === 1 && theirs === 1 && onlyRaja(pos.board, side) && onlyRaja(pos.board, opp)) {
    return { kind: "draw", reason: "lone_kings" };
  }

  if (mine === 1 && theirs >= 2 && onlyRaja(pos.board, side)) {
    for (const m of legalMoves(pos)) {
      const next = applyMove(pos, m);
      if (countColor(next.board, opp) === 1) return { kind: "draw", reason: "mutual_bare" };
    }
    return { kind: "win", winner: opp, reason: "bare_raja" };
  }

  if (theirs === 1 && mine >= 2 && onlyRaja(pos.board, opp)) {
    return { kind: "win", winner: side, reason: "bare_raja" };
  }

  const legal = legalMoves(pos);
  if (legal.length === 0) {
    return {
      kind: "win",
      winner: opp,
      reason: inCheck(pos) ? "checkmate" : "stalemate",
    };
  }

  const now = pos.keys[pos.keys.length - 1];
  let seen = 0;
  for (const k of pos.keys) if (k === now) seen++;
  if (seen >= 3) return { kind: "draw", reason: "repetition" };

  return { kind: "ongoing" };
}

export function formatMove(pos: Position, move: Move, legal: Move[]): string {
  const dest = coord(move.to);
  let san: string;
  if (move.piece === "P") {
    san = (move.captured ? coord(move.from)[0] + "x" : "") + dest + (move.promotion ? "=M" : "");
  } else {
    const rivals = legal.filter(
      (m) => m.piece === move.piece && m.to === move.to && m.from !== move.from,
    );
    let dis = "";
    if (rivals.length) {
      const file = coord(move.from)[0];
      const rank = coord(move.from)[1];
      dis = rivals.some((m) => coord(m.from)[0] === file) ? rank : file;
    }
    san = move.piece + dis + (move.captured ? "x" : "") + dest;
  }
  const next = applyMove(pos, move);
  const end = outcome(next);
  if (end.kind === "win" && end.reason === "checkmate") san += "#";
  else if (inCheck(next)) san += "+";
  return san;
}

export function replay(moves: Move[]): Position | null {
  let pos = startPosition();
  for (const m of moves) {
    const legal = legalMoves(pos);
    const found = legal.find((x) => x.from === m.from && x.to === m.to && x.promotion === m.promotion);
    if (!found) return null;
    pos = applyMove(pos, found);
  }
  return pos;
}

export type Level = 1 | 2 | 3 | 4;

export const ENGINES: Record<Level, { name: string; blurb: string }> = {
  1: { name: "Padati", blurb: "One look ahead. Forgiving, good for learning the leaps." },
  2: { name: "Ashva", blurb: "Everyday opponent. Sees tactics and keeps the Raja safe." },
  3: { name: "Gaja", blurb: "Deeper search. Punishes loose chariots and bare-Raja mistakes." },
  4: { name: "Raja", blurb: "Deepest search on this board. Slow, stubborn, and hard to trick." },
};

function pst(type: PieceType, sq: number, color: Color): number {
  const file = fileOf(sq);
  const rank = rankOf(sq);
  const rr = color === "w" ? rank : 7 - rank;
  const center = 7 - (Math.abs(file - 3.5) + Math.abs(rank - 3.5));
  if (type === "P") return rr * 2 + center;
  if (type === "A" || type === "M") return center * 3;
  if (type === "G") return center * 2;
  if (type === "R") return rr + center;
  if (type === "K") return rr < 2 ? 4 : center;
  return 0;
}

function evaluate(pos: Position): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i];
    if (!p) continue;
    const sign = p.color === pos.turn ? 1 : -1;
    s += sign * (MAT[p.type] + pst(p.type, i, p.color));
  }
  return s;
}

function ordered(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    const av = a.captured ? MAT[a.captured] * 8 - MAT[a.piece] : 0;
    const bv = b.captured ? MAT[b.captured] * 8 - MAT[b.piece] : 0;
    return bv - av;
  });
}

function negamax(
  pos: Position,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  budget: { n: number; max: number; deadline: number; quiet: boolean },
): number {
  if (budget.n++ > budget.max || Date.now() > budget.deadline) return evaluate(pos);
  const end = outcome(pos);
  if (end.kind === "draw") return 0;
  if (end.kind === "win") return end.winner === pos.turn ? 100000 - ply : ply - 100000;
  if (depth <= 0) return budget.quiet ? qsearch(pos, alpha, beta, ply, budget) : evaluate(pos);
  let best = -Infinity;
  for (const m of ordered(legalMoves(pos))) {
    const v = -negamax(applyMove(pos, m), depth - 1, -beta, -alpha, ply + 1, budget);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluate(pos) : best;
}

function qsearch(
  pos: Position,
  alpha: number,
  beta: number,
  ply: number,
  budget: { n: number; max: number; deadline: number },
): number {
  if (budget.n++ > budget.max || Date.now() > budget.deadline || ply > 6) return evaluate(pos);
  const end = outcome(pos);
  if (end.kind === "draw") return 0;
  if (end.kind === "win") return end.winner === pos.turn ? 100000 - ply : ply - 100000;
  const stand = evaluate(pos);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of ordered(legalMoves(pos)).filter((m) => m.captured)) {
    const v = -qsearch(applyMove(pos, m), -beta, -alpha, ply + 1, budget);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

const SEARCH: Record<Level, { depth: number; max: number; ms: number; noise: number; quiet: boolean }> = {
  1: { depth: 2, max: 6000, ms: 80, noise: 90, quiet: false },
  2: { depth: 3, max: 18000, ms: 220, noise: 18, quiet: false },
  3: { depth: 4, max: 70000, ms: 700, noise: 0, quiet: true },
  4: { depth: 5, max: 160000, ms: 1400, noise: 0, quiet: true },
};

export function pickAiMove(pos: Position, level: Level): Move | null {
  const moves = ordered(legalMoves(pos));
  if (!moves.length) return null;
  const spec = SEARCH[level];
  const budget = { n: 0, max: spec.max, deadline: Date.now() + spec.ms, quiet: spec.quiet };
  let best = -Infinity;
  const scored: { m: Move; v: number }[] = [];
  let alpha = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(pos, m), spec.depth - 1, -Infinity, -alpha, 1, budget);
    scored.push({ m, v });
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (Date.now() > budget.deadline) break;
  }
  if (!scored.length) return moves[0];
  const top = Math.max(...scored.map((s) => s.v));
  if (spec.noise > 0) {
    const pool = scored.filter((s) => s.v >= top - spec.noise);
    return pool[Math.floor(Math.random() * pool.length)]?.m ?? moves[0];
  }
  return scored.find((s) => s.v === top)?.m ?? moves[0];
}

export function materialQuarters(board: (Piece | null)[], color: Color): number {
  let n = 0;
  for (const p of board) if (p && p.color === color && p.type !== "K") n += MATERIAL[p.type];
  return n;
}
