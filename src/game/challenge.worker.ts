import { pickChallengeMove, type ChallengeState, type CMove } from "./challenge.ts";

self.onmessage = (event: MessageEvent<ChallengeState>) => {
  const move: CMove | null = pickChallengeMove(event.data);
  self.postMessage(move);
};
