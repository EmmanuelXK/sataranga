import { challengeThinkBudget, pickChallengeMove, type ChallengeState, type CMove } from "./challenge.ts";

self.onmessage = (event: MessageEvent<ChallengeState>) => {
  const state = event.data;
  const move: CMove | null = pickChallengeMove(state, { ms: challengeThinkBudget(state) });
  self.postMessage(move);
};
