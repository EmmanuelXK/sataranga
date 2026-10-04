export type BoardId = "brown" | "green" | "blue" | "grey";

export type BoardTheme = {
  id: BoardId;
  name: string;
  light: string;
  dark: string;
};

/** Square colors. Brown ivory is the Lichess brown board. */
export const BOARDS: BoardTheme[] = [
  { id: "brown", name: "Brown ivory", light: "#f0d9b5", dark: "#b58863" },
  { id: "green", name: "Green", light: "#eeeed2", dark: "#769656" },
  { id: "blue", name: "Blue", light: "#d4e1f2", dark: "#3a6ea5" },
  { id: "grey", name: "Grey white", light: "#f4f2ee", dark: "#8a8680" },
];

const KEY = "sataranga-board";

export function readBoard(): BoardId {
  const saved = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
  return BOARDS.some((b) => b.id === saved) ? (saved as BoardId) : "brown";
}

export function writeBoard(id: BoardId) {
  localStorage.setItem(KEY, id);
}

export function boardTheme(id: BoardId): BoardTheme {
  return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
}
