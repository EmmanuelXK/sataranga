import assert from "node:assert/strict";
import { test } from "node:test";
import { displayClocks } from "./clocks.ts";

test("a running clock only falls by the server elapsed time", () => {
  const shown = displayClocks({
    whiteMs: 180000,
    blackMs: 180000,
    side: "w",
    clockUpdatedAt: 1_000,
    serverNow: 4_000,
    clientNow: 9_000,
    running: true,
  });
  assert.deepEqual(shown, { w: 177000, b: 180000 });
});

test("a stopped clock ignores the wall clock", () => {
  const shown = displayClocks({
    whiteMs: 12000,
    blackMs: 4000,
    side: "b",
    clockUpdatedAt: 0,
    serverNow: 50_000,
    clientNow: 50_000,
    running: false,
  });
  assert.deepEqual(shown, { w: 12000, b: 4000 });
});

test("the side to move cannot go below zero", () => {
  const shown = displayClocks({
    whiteMs: 1000,
    blackMs: 9000,
    side: "w",
    clockUpdatedAt: 0,
    serverNow: 5000,
    clientNow: 5000,
    running: true,
  });
  assert.equal(shown.w, 0);
});
