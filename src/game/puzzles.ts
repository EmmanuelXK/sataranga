import {
  applyMove,
  coord,
  legalMoves,
  makePosition,
  outcome,
  type Color,
  type Move,
  type Piece,
  type PieceType,
  type Position,
} from "./engine.ts";

/** Separate from the coin-claim streak in `yuddha-profile-v1`. */
export const PUZZLE_KEY = "sataranga-daily-puzzle-v1";

export type PuzzleReason = "checkmate" | "stalemate" | "bare_raja";

export type DailyPuzzle = {
  id: string;
  side: Color;
  title: string;
  /** SATARANGA rule the position is built on. Shown before the move. */
  rule: string;
  goal: string;
  /** Piece the player should be thinking about. Revealed only after a miss. */
  actor: string;
  solved: string;
  setup: string;
  from: string;
  to: string;
  reason: PuzzleReason;
};

/**
 * Curated Ashtapada positions. Each one has a single winning move under the
 * SATARANGA engine (Mantri, Gaja, Hewa promotion, stalemate, bare Raja).
 * A calendar day picks one by local date, then the set repeats.
 */
export const DAILY_PUZZLES: DailyPuzzle[] = [
  {
    id: "counselor",
    side: "w",
    title: "Counselor's step",
    rule: "The Mantri steps one square diagonally, and only diagonally.",
    goal: "Mate the Raja.",
    actor: "Mantri",
    solved: "The Mantri stepped to b7. The Hewa on b6 holds a7, and the Raja on c7 holds b8.",
    setup: "wKc7 wPb6 wMc6 bKa8 bPh7",
    from: "c6",
    to: "b7",
    reason: "checkmate",
  },
  {
    id: "elephant",
    side: "w",
    title: "Elephant's leap",
    rule: "The Gaja leaps two squares diagonally and jumps anything in between.",
    goal: "Mate the Raja.",
    actor: "Gaja",
    solved: "The Gaja leapt from e4 to c6. The Hewa on a7 blocks one flight, and the Raja on c7 holds the others.",
    setup: "wKc7 wGe4 bKa8 bPa7",
    from: "e4",
    to: "c6",
    reason: "checkmate",
  },
  {
    id: "chariot-rank",
    side: "w",
    title: "Chariot on the rank",
    rule: "The Ratha slides any distance on a rank or file. There is no castling.",
    goal: "Mate the Raja.",
    actor: "Ratha",
    solved: "The Ratha slid to c8. The Raja on b6 takes away a7 and b7.",
    setup: "wKb6 wRc4 bKa8 bPh7",
    from: "c4",
    to: "c8",
    reason: "checkmate",
  },
  {
    id: "no-reply",
    side: "w",
    title: "No reply",
    rule: "A Raja with no legal move loses, even when it is not in check.",
    goal: "Leave the Raja with no move.",
    actor: "Hewa",
    solved: "The Hewa stepped to a6. Black is not in check, and neither the Raja nor the Hewa can move. That is a loss.",
    setup: "wKc7 wPa5 bKa8 bPa7",
    from: "a5",
    to: "a6",
    reason: "stalemate",
  },
  {
    id: "promotion",
    side: "w",
    title: "Hewa to Mantri",
    rule: "A Hewa promotes to a Mantri. It does not become a greater piece.",
    goal: "Mate the Raja.",
    actor: "Hewa",
    solved: "The Hewa promoted on b8 to a Mantri. That diagonal step checks the Raja, and the Gaja holds a8.",
    setup: "wKc8 wGc6 wPb7 bKa7 bPa6 bPb6",
    from: "b7",
    to: "b8",
    reason: "checkmate",
  },
  {
    id: "horse",
    side: "w",
    title: "Horse in the corner",
    rule: "The Ashva jumps in an L: two squares one way, then one to the side.",
    goal: "Mate the Raja.",
    actor: "Ashva",
    solved: "The Ashva jumped to b3. The Hewa on a2 and b2 block the Raja, and the Raja on c2 holds b1.",
    setup: "wKc2 wAc5 bKa1 bPa2 bPb2",
    from: "c5",
    to: "b3",
    reason: "checkmate",
  },
  {
    id: "last-hewa",
    side: "w",
    title: "Last Hewa",
    rule: "A bare Raja loses when the other side still has a piece and cannot be stripped in reply.",
    goal: "Win by the bare-Raja rule.",
    actor: "Ratha",
    solved: "The Ratha took the last Hewa on b2. Black is left with only the Raja.",
    setup: "wKa3 wRc2 bKa1 bPb2",
    from: "c2",
    to: "b2",
    reason: "bare_raja",
  },
  {
    id: "three-hewa",
    side: "w",
    title: "Three Hewa",
    rule: "The Ratha slides on ranks and files. A Hewa moves only one square, with no double step.",
    goal: "Mate the Raja.",
    actor: "Ratha",
    solved: "The Ratha reached a8. The Hewa on f7, g7, and h7 leave the Raja no way out.",
    setup: "wKb1 wRa2 bKg8 bPf7 bPg7 bPh7",
    from: "a2",
    to: "a8",
    reason: "checkmate",
  },
  {
    id: "counselor-black",
    side: "b",
    title: "Counselor's step",
    rule: "The Mantri steps one square diagonally, and only diagonally.",
    goal: "Mate the Raja.",
    actor: "Mantri",
    solved: "The Mantri stepped to b2. The Hewa on b3 holds a2, and the Raja on c2 holds b1.",
    setup: "bKc2 bPb3 bMc3 wKa1 wPh2",
    from: "c3",
    to: "b2",
    reason: "checkmate",
  },
  {
    id: "elephant-black",
    side: "b",
    title: "Elephant's leap",
    rule: "The Gaja leaps two squares diagonally and jumps anything in between.",
    goal: "Mate the Raja.",
    actor: "Gaja",
    solved: "The Gaja leapt from e5 to c3. The Hewa on a2 blocks one flight, and the Raja on c2 holds the others.",
    setup: "bKc2 bGe5 wKa1 wPa2",
    from: "e5",
    to: "c3",
    reason: "checkmate",
  },
  {
    id: "horse-black",
    side: "b",
    title: "Horse in the corner",
    rule: "The Ashva jumps in an L: two squares one way, then one to the side.",
    goal: "Mate the Raja.",
    actor: "Ashva",
    solved: "The Ashva jumped to b6. The Hewa on a7 and b7 block the Raja, and the Raja on c7 holds b8.",
    setup: "bKc7 bAc4 wKa8 wPa7 wPb7",
    from: "c4",
    to: "b6",
    reason: "checkmate",
  },
  {
    id: "no-reply-black",
    side: "b",
    title: "No reply",
    rule: "A Raja with no legal move loses, even when it is not in check.",
    goal: "Leave the Raja with no move.",
    actor: "Hewa",
    solved: "The Hewa stepped to a3. White has no legal move, and that is a loss.",
    setup: "bKc2 bPa4 wKa1 wPa2",
    from: "a4",
    to: "a3",
    reason: "stalemate",
  },
  {
    id: "elephant-takes",
    side: "w",
    title: "Elephant takes the last",
    rule: "A bare Raja loses when the other side still has a piece. The Gaja leaps two squares diagonally.",
    goal: "Win by the bare-Raja rule.",
    actor: "Gaja",
    solved: "The Gaja leapt onto b4 and took the last Hewa.",
    setup: "wKc5 wGd6 bKa3 bPb4",
    from: "d6",
    to: "b4",
    reason: "bare_raja",
  },
  {
    id: "counselor-takes",
    side: "w",
    title: "Counselor takes the last",
    rule: "A bare Raja loses when the other side still has a piece. The Mantri steps one diagonal.",
    goal: "Win by the bare-Raja rule.",
    actor: "Mantri",
    solved: "The Mantri took the last Hewa on b5.",
    setup: "wKc6 wMa6 bKa4 bPb5",
    from: "a6",
    to: "b5",
    reason: "bare_raja",
  },
  {
    id: "chariot-clears",
    side: "w",
    title: "Chariot clears the file",
    rule: "A bare Raja loses when the other side still has a piece. The Ratha slides on ranks and files.",
    goal: "Win by the bare-Raja rule.",
    actor: "Ratha",
    solved: "The Ratha took the last Hewa on g7.",
    setup: "wKf8 wRe7 bKh8 bPg7",
    from: "e7",
    to: "g7",
    reason: "bare_raja",
  },
  {
    id: "chariot-black",
    side: "b",
    title: "Chariot on the file",
    rule: "The Ratha slides any distance on a rank or file. There is no castling.",
    goal: "Mate the Raja.",
    actor: "Ratha",
    solved: "The Ratha slid to a1. The Hewa on f2, g2, and h2 close the Raja in.",
    setup: "bKb8 bRa7 wKg1 wPf2 wPg2 wPh2",
    from: "a7",
    to: "a1",
    reason: "checkmate",
  },
];

export type PuzzleRecord = {
  v: 1;
  streak: number;
  /** Local calendar day `YYYY-MM-DD`, or empty when none is solved yet. */
  lastSolved: string;
};

export function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function previousDayKey(date: Date): string {
  return localDayKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 1));
}

/** Whole local calendar days since the Unix epoch. Same local date, same puzzle. */
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
}

export function puzzleForDate(date: Date, catalog: DailyPuzzle[] = DAILY_PUZZLES): DailyPuzzle {
  const index = localDayNumber(date) % catalog.length;
  return catalog[index];
}

export function sideName(side: Color): string {
  return side === "w" ? "White" : "Black";
}

function squareOf(label: string): number {
  if (!/^[a-h][1-8]$/.test(label)) throw new Error(`Bad square ${label}`);
  return (label.charCodeAt(0) - 97) + (Number(label[1]) - 1) * 8;
}

export function positionFromSetup(setup: string, turn: Color): Position {
  const board: (Piece | null)[] = Array.from({ length: 64 }, () => null);
  for (const token of setup.split(/\s+/).filter(Boolean)) {
    const match = /^([wb])([KMGARP])([a-h][1-8])$/.exec(token);
    if (!match) throw new Error(`Bad piece ${token}`);
    const sq = squareOf(match[3]);
    if (board[sq]) throw new Error(`Two pieces on ${match[3]}`);
    board[sq] = { color: match[1] as Color, type: match[2] as PieceType };
  }
  return makePosition(board, turn);
}

export function winningMoves(pos: Position): Move[] {
  return legalMoves(pos).filter((move) => {
    if (move.captured === "K") return false;
    const end = outcome(applyMove(pos, move));
    return end.kind === "win" && end.winner === pos.turn;
  });
}

export function findSolution(puzzle: DailyPuzzle): Move {
  const pos = positionFromSetup(puzzle.setup, puzzle.side);
  const move = winningMoves(pos).find((item) => coord(item.from) === puzzle.from && coord(item.to) === puzzle.to);
  if (!move) throw new Error(`Puzzle ${puzzle.id} has no solution ${puzzle.from}${puzzle.to}`);
  return move;
}

export function freshPuzzleRecord(): PuzzleRecord {
  return { v: 1, streak: 0, lastSolved: "" };
}

/**
 * Streak still counts on the day after a solve. A missed calendar day shows 0
 * until today's puzzle is solved, which starts the streak at 1.
 */
export function streakStatus(
  record: PuzzleRecord,
  today: string,
  yesterday: string,
): { streak: number; solvedToday: boolean } {
  if (record.lastSolved === today) return { streak: Math.max(0, record.streak), solvedToday: true };
  if (record.lastSolved === yesterday && record.streak > 0) return { streak: record.streak, solvedToday: false };
  return { streak: 0, solvedToday: false };
}

/** Solving today once extends a live streak. Solving again the same day does not. */
export function recordSolve(record: PuzzleRecord, today: string, yesterday: string): PuzzleRecord {
  if (record.lastSolved === today) return record;
  const streak = record.lastSolved === yesterday && record.streak > 0 ? record.streak + 1 : 1;
  return { v: 1, streak, lastSolved: today };
}

export function loadPuzzleRecord(): PuzzleRecord {
  if (typeof localStorage === "undefined") return freshPuzzleRecord();
  try {
    const data = JSON.parse(localStorage.getItem(PUZZLE_KEY) || "") as Partial<PuzzleRecord>;
    if (data.v !== 1) return freshPuzzleRecord();
    const streak = Math.max(0, Math.floor(Number(data.streak) || 0));
    const lastSolved = typeof data.lastSolved === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.lastSolved) ? data.lastSolved : "";
    return { v: 1, streak, lastSolved };
  } catch {
    return freshPuzzleRecord();
  }
}

export function markPuzzleSolved(now = new Date()): PuzzleRecord {
  const next = recordSolve(loadPuzzleRecord(), localDayKey(now), previousDayKey(now));
  try {
    localStorage.setItem(PUZZLE_KEY, JSON.stringify(next));
  } catch {
    /* the solve still counts for this visit */
  }
  return next;
}

/** True when this move wins at once for the side to move. Taking the Raja is not a puzzle win. */
export function moveWins(pos: Position, move: Move): boolean {
  if (move.captured === "K") return false;
  const end = outcome(applyMove(pos, move));
  return end.kind === "win" && end.winner === pos.turn;
}

export function isSolvedToday(now = new Date()): boolean {
  const record = loadPuzzleRecord();
  return streakStatus(record, localDayKey(now), previousDayKey(now)).solvedToday;
}
