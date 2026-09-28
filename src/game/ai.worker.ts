import { pickAiMove, type Level, type Move, type Position } from "./engine";

self.onmessage = (event: MessageEvent<{ pos: Position; level: Level }>) => {
  const { pos, level } = event.data;
  const move: Move | null = pickAiMove(pos, level);
  self.postMessage(move);
};
