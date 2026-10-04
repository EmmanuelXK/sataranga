import assert from "node:assert/strict";
import test from "node:test";
import { pointInBoard } from "./boards.ts";
import { resultStamp } from "./career.ts";
import { claimDayValue, profileIsNewer, type Profile } from "./profile.ts";

const row = (patch: Partial<Profile> = {}): Profile => ({
  v: 1,
  coins: 0,
  rating: 400,
  wins: 0,
  losses: 0,
  draws: 0,
  heads: 0,
  streak: 0,
  lastClaim: "",
  ...patch,
});

test("claim days compare without zero-padding", () => {
  assert.ok(claimDayValue("2026-10-4") > claimDayValue("2026-9-30"));
  assert.ok(claimDayValue("2026-10-9") > claimDayValue("2026-9-1"));
  assert.equal(claimDayValue("nope"), 0);
});

test("a newer local record wins, an equal one does not", () => {
  const remote = row({ wins: 2, coins: 20, lastClaim: "2026-10-3" });
  assert.equal(profileIsNewer(row({ wins: 3, coins: 10 }), remote), true);
  assert.equal(profileIsNewer(row({ wins: 2, coins: 40, lastClaim: "2026-10-4" }), remote), true);
  assert.equal(profileIsNewer(row({ wins: 2, coins: 20, lastClaim: "2026-10-3" }), remote), false);
  assert.equal(profileIsNewer(row(), row({ wins: 1 })), false);
});

test("finished games with the same result stay distinct", () => {
  const a = resultStamp("win:wcheckmate", [{ from: 12, to: 20, promotion: false }]);
  const b = resultStamp("win:wcheckmate", [{ from: 11, to: 19, promotion: false }]);
  assert.notEqual(a, b);
  assert.equal(a, resultStamp("win:wcheckmate", [{ from: 12, to: 20, promotion: false }]));
});

test("drag points are board-local, not viewport coordinates", () => {
  assert.deepEqual(pointInBoard(180, 240, { left: 100, top: 80 }), { x: 80, y: 160 });
});
