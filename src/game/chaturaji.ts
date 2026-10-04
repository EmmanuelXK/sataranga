/** Chathuraja — four-king Chaturaji. Ashtapadha is a different game and is not touched here. */

/** Locked icons. Do not replace these files: b/w raja, hasthi, ashwa, yathra, padati. */
export const PIECE_SET = "NEO CHATHURAJA" as const;
export const RETRO_SET = "RETRO CHATHURAJA" as const;
export type PieceSet = "neo" | "retro";

const SET_KEY = "chathuraja-set";

export function readPieceSet(): PieceSet {
  if (typeof localStorage === "undefined") return "retro";
  return localStorage.getItem(SET_KEY) === "neo" ? "neo" : "retro";
}

export function writePieceSet(set: PieceSet) {
  localStorage.setItem(SET_KEY, set);
}

/** Vintage enamel. Highlight, body, shade. Same shapes as NEO. */
export const RETRO_PAINT: Record<Army, { hi: string; mid: string; lo: string }> = {
  red: { hi: "#F6C7B8", mid: "#B4332A", lo: "#5C1210" },
  green: { hi: "#C9D9EC", mid: "#1B4F86", lo: "#0A2744" },
  black: { hi: "#B7E0CF", mid: "#0F6B4C", lo: "#063526" },
  gold: { hi: "#E7C4F2", mid: "#7B2A96", lo: "#3E1054" },
};

export type Army = "red" | "green" | "black" | "gold";
export type CType = "K" | "G" | "A" | "Y" | "P";
export type Face = "K" | "G" | "A" | "Y";

/** Clockwise from the south: Red, Blue, Teal, Purple. */
export const TURN: Army[] = ["red", "green", "black", "gold"];

export const ARMY_NAME: Record<Army, string> = {
  red: "Red",
  green: "Blue",
  black: "Green",
  gold: "Purple",
};

export const PIECE_NAME: Record<CType, string> = {
  K: "Raja",
  G: "Gaja",
  A: "Ashva",
  Y: "Yathra",
  P: "Hewa",
};

export const FACE_NAME: Record<Face, string> = {
  K: "Raja",
  G: "Gaja",
  A: "Ashva",
  Y: "Yathra",
};

/** Capture points from the old scale. A Chaturaji (all three enemy rajas) adds 54. */
export const POINTS: Record<CType, number> = { P: 1, Y: 2, A: 3, G: 4, K: 5 };

export const ARMY_INK: Record<Army, string> = {
  red: "#E53935",
  green: "#124E78",
  black: "#087A5B",
  gold: "#8E24AA",
};

export type CPiece = { army: Army; type: CType; promo?: CType };

export type CMove = {
  from: number;
  to: number;
  captured: CPiece | null;
  promo: CType | null;
};

export type CState = {
  board: (CPiece | null)[];
  turn: Army;
  scores: Record<Army, number>;
  taken: Record<Army, number>;
  thrones: Record<Army, number>;
  dice: boolean;
  /** The two faces for this turn. Empty until the dice are rolled. */
  rolls: Face[];
  /** 0 = first move, 1 = second move. */
  step: 0 | 1;
  /** A piece has moved during this turn. */
  acted: boolean;
  face: Face | null;
  passes: number;
  over: boolean;
  note: string;
  alive: Record<Army, boolean>;
};

const KNIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

const FWD: Record<Army, [number, number]> = {
  red: [0, 1],
  green: [1, 0],
  black: [0, -1],
  gold: [-1, 0],
};

const BACK: CType[] = ["Y", "A", "G", "K"];

function emptyScores(): Record<Army, number> {
  return { red: 0, green: 0, black: 0, gold: 0 };
}

function emptyAlive(): Record<Army, boolean> {
  return { red: true, green: true, black: true, gold: true };
}

export function fileOf(sq: number): number {
  return sq % 8;
}

export function rankOf(sq: number): number {
  return Math.floor(sq / 8);
}

function onBoard(f: number, r: number): boolean {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

function sq(f: number, r: number): number {
  return r * 8 + f;
}

export function startState(dice: boolean): CState {
  const board: (CPiece | null)[] = Array.from({ length: 64 }, () => null);
  const put = (f: number, r: number, army: Army, type: CType, promo?: CType) => {
    board[sq(f, r)] = { army, type, promo };
  };
  for (let i = 0; i < 4; i++) {
    put(i, 0, "red", BACK[i]);
    put(i, 1, "red", "P", BACK[i]);
    put(0, 7 - i, "green", BACK[i]);
    put(1, 7 - i, "green", "P", BACK[i]);
    put(7 - i, 7, "black", BACK[i]);
    put(7 - i, 6, "black", "P", BACK[i]);
    put(7, i, "gold", BACK[i]);
    put(6, i, "gold", "P", BACK[i]);
  }
  return {
    board,
    turn: "red",
    scores: emptyScores(),
    taken: emptyScores(),
    thrones: { red: sq(3, 0), green: sq(0, 4), black: sq(4, 7), gold: sq(7, 3) },
    dice,
    rolls: [],
    step: 0,
    acted: false,
    face: null,
    passes: 0,
    over: false,
    note: "",
    alive: emptyAlive(),
  };
}

function pawnCaps(army: Army): [number, number][] {
  const [df, dr] = FWD[army];
  if (df === 0) return [
    [-1, dr],
    [1, dr],
  ];
  return [
    [df, -1],
    [df, 1],
  ];
}

function onPromoSquare(army: Army, to: number): boolean {
  const f = fileOf(to);
  const r = rankOf(to);
  if (army === "red") return r === 7;
  if (army === "black") return r === 0;
  if (army === "green") return f === 7;
  return f === 0;
}

function typeOnBoard(board: (CPiece | null)[], army: Army, type: CType): boolean {
  return board.some((p) => p?.army === army && p.type === type);
}

function push(
  out: CMove[],
  board: (CPiece | null)[],
  from: number,
  to: number,
  piece: CPiece,
) {
  const target = board[to];
  if (target && target.army === piece.army) return;
  let promo: CType | null = null;
  if (piece.type === "P" && onPromoSquare(piece.army, to)) {
    if (!piece.promo || typeOnBoard(board, piece.army, piece.promo)) return;
    promo = piece.promo;
  }
  out.push({ from, to, captured: target, promo });
}

export function movesFor(state: CState, army: Army = state.turn): CMove[] {
  if (!state.alive[army]) return [];
  const board = state.board;
  const out: CMove[] = [];
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece.army !== army) continue;
    const f = fileOf(from);
    const r = rankOf(from);
    if (piece.type === "P") {
      const [df, dr] = FWD[army];
      const f2 = f + df;
      const r2 = r + dr;
      if (onBoard(f2, r2) && !board[sq(f2, r2)]) push(out, board, from, sq(f2, r2), piece);
      for (const [cf, cr] of pawnCaps(army)) {
        const fx = f + cf;
        const ry = r + cr;
        if (!onBoard(fx, ry)) continue;
        const t = board[sq(fx, ry)];
        if (t && t.army !== army) push(out, board, from, sq(fx, ry), piece);
      }
    } else if (piece.type === "A") {
      for (const [df, dr] of KNIGHT) {
        const f2 = f + df;
        const r2 = r + dr;
        if (onBoard(f2, r2)) push(out, board, from, sq(f2, r2), piece);
      }
    } else if (piece.type === "G") {
      for (const df of [-2, 2]) {
        for (const dr of [-2, 2]) {
          const f2 = f + df;
          const r2 = r + dr;
          if (onBoard(f2, r2)) push(out, board, from, sq(f2, r2), piece);
        }
      }
    } else if (piece.type === "K") {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (!df && !dr) continue;
          const f2 = f + df;
          const r2 = r + dr;
          if (onBoard(f2, r2)) push(out, board, from, sq(f2, r2), piece);
        }
      }
    } else {
      for (const [df, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as [number, number][]) {
        let f2 = f + df;
        let r2 = r + dr;
        while (onBoard(f2, r2)) {
          const to = sq(f2, r2);
          const t = board[to];
          if (!t) push(out, board, from, to, piece);
          else {
            if (t.army !== army) push(out, board, from, to, piece);
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

export function rollFace(): Face {
  const faces: Face[] = ["K", "G", "A", "Y"];
  return faces[Math.floor(Math.random() * 4)];
}

/** Two dice, always two different pieces. */
export function rollPair(): [Face, Face] {
  const first = rollFace();
  const rest = (["K", "G", "A", "Y"] as Face[]).filter((face) => face !== first);
  return [first, rest[Math.floor(Math.random() * rest.length)]];
}

/** Raja is king or hewa. Any other face is that piece. A hewa stands in only if it has been taken, never when it is merely blocked. */
export function movesForFace(state: CState, face: Face): CMove[] {
  const all = movesFor(state);
  const of = (type: CType) => all.filter((m) => state.board[m.from]?.type === type);
  if (face === "K") return [...of("K"), ...of("P")];
  const exact = of(face);
  if (exact.length || state.board.some((p) => p?.army === state.turn && p.type === face)) return exact;
  return of("P");
}

function nextAlive(turn: Army, alive: Record<Army, boolean>): Army {
  let i = TURN.indexOf(turn);
  for (let n = 0; n < 4; n++) {
    i = (i + 1) % 4;
    if (alive[TURN[i]]) return TURN[i];
  }
  return turn;
}

function boatTriumph(board: (CPiece | null)[], to: number): number[] {
  const f = fileOf(to);
  const r = rankOf(to);
  for (const cf of [f - 1, f]) {
    for (const cr of [r - 1, r]) {
      if (cf < 0 || cr < 0 || cf > 6 || cr > 6) continue;
      const block = [sq(cf, cr), sq(cf + 1, cr), sq(cf, cr + 1), sq(cf + 1, cr + 1)];
      if (!block.every((s) => board[s]?.type === "Y")) continue;
      return block.filter((s) => s !== to);
    }
  }
  return [];
}

function land(state: CState, move: CMove, keep: boolean): CState {
  const board = state.board.slice();
  const piece = board[move.from];
  if (!piece) return state;
  const born: CPiece = move.promo ? { army: piece.army, type: move.promo } : { ...piece };
  board[move.from] = null;
  board[move.to] = born;
  let score = state.scores[piece.army];
  let note = "";
  const taken = { ...state.taken };
  const alive = { ...state.alive };
  if (move.captured) {
    score += POINTS[move.captured.type];
    if (move.captured.type === "K") {
      alive[move.captured.army] = false;
      taken[piece.army] += 1;
      if (taken[piece.army] === 3 && alive[piece.army]) {
        score += 54;
        note = "Chaturaji";
      } else note = `${ARMY_NAME[move.captured.army]} raja falls`;
    }
  }
  if (piece.type === "Y") {
    const victims = boatTriumph(board, move.to);
    if (victims.length) {
      for (const s of victims) {
        if (board[s]) score += POINTS.Y;
        board[s] = null;
      }
      note = "Boat triumph";
    }
  }
  if (piece.type === "K") {
    const throne = (Object.entries(state.thrones) as [Army, number][]).find(
      ([army, s]) => army !== piece.army && s === move.to,
    );
    if (throne) {
      score += 1;
      if (!note) note = "Sinhasana";
    }
  }
  const scores = { ...state.scores, [piece.army]: score };
  const living = TURN.filter((a) => alive[a]);
  const over = living.length <= 1;
  const base = { ...state, board, scores, taken, alive, over, note };
  if (over || !keep) {
    return { ...base, turn: over ? piece.army : nextAlive(state.turn, alive), passes: 0, face: null, rolls: [], step: 0, acted: false };
  }
  const step = (state.step + 1) as 0 | 1;
  return { ...base, turn: state.turn, acted: true, step, face: state.rolls[step] ?? null };
}

/** Stay for the second die, or hand the turn on when this was the last move. */
export function applyMove(state: CState, move: CMove, keep = false): CState {
  return land(state, move, keep);
}

export function skipStep(state: CState): CState {
  const last = !state.dice || state.step >= 1;
  if (!last) {
    return { ...state, step: 1, face: state.rolls[1] ?? null, note: "Passed" };
  }
  const passes = state.acted ? 0 : state.passes + 1;
  const over = passes >= 4 || TURN.filter((a) => state.alive[a]).length <= 1;
  return {
    ...state,
    turn: nextAlive(state.turn, state.alive),
    passes,
    over,
    note: over && !state.acted ? "No moves remain" : state.acted ? "" : "Passed",
    face: null,
    rolls: [],
    step: 0,
    acted: false,
  };
}

export function faceHint(state: CState, face: Face): string {
  const all = movesFor(state);
  const has = (type: CType) => all.some((m) => state.board[m.from]?.type === type);
  const gone = (type: CType) => !state.board.some((p) => p?.army === state.turn && p.type === type);
  const stuck = (name: string, type: CType) =>
    gone(type) ? (has("P") ? `${name} is gone. Move a Hewa.` : `${name} is gone. This die is lost.`) : `${name} is blocked. This die is lost.`;
  if (face === "G") return has("G") ? "Only the Gaja. It jumps two squares diagonally." : stuck("Gaja", "G");
  if (face === "Y") return has("Y") ? "Only the Yathra. It slides any free squares along a rank or file." : stuck("Yathra", "Y");
  if (face === "A") return has("A") ? "Only the Ashva. It leaps in an L and jumps." : stuck("Ashva", "A");
  return "Only the Raja, or a Hewa.";
}

export function passTurn(state: CState): CState {
  const passes = state.passes + 1;
  const over = passes >= 4 || TURN.filter((a) => state.alive[a]).length <= 1;
  return {
    ...state,
    turn: nextAlive(state.turn, state.alive),
    passes,
    over,
    note: over ? "No moves remain" : "Passed",
    face: null,
  };
}

export function chooseMove(board: (CPiece | null)[], moves: CMove[]): CMove {
  const value = (m: CMove) => (m.captured ? POINTS[m.captured.type] * 20 : 0) + (m.promo ? 6 : 0);
  const best = Math.max(...moves.map(value));
  const pool = moves.filter((m) => value(m) === best);
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Screen cell for the army sitting at the bottom. Forward points up. */
export function viewCell(view: Army, square: number): { row: number; col: number } {
  const f = fileOf(square);
  const r = rankOf(square);
  if (view === "red") return { row: 7 - r, col: f };
  if (view === "green") return { row: 7 - f, col: 7 - r };
  if (view === "black") return { row: r, col: 7 - f };
  return { row: f, col: r };
}

export function leader(state: CState): Army {
  return TURN.slice().sort((a, b) => state.scores[b] - state.scores[a])[0];
}
