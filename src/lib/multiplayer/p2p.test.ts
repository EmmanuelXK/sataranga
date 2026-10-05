import assert from "node:assert/strict";
import test from "node:test";
import { pairRoom } from "./match.ts";
import { decodeSignalPayload } from "./p2p.ts";

test("blitz auto-pair gives both players the same room", () => {
  assert.equal(pairRoom("pa", "pb"), pairRoom("pb", "pa"));
  assert.notEqual(pairRoom("pa", "pb"), pairRoom("pa", "pc"));
  assert.match(pairRoom("p1", "p2"), /^[a-z2-9]{6}$/);
});

test("signal payloads decode one or two layers of JSON text", () => {
  const offer = { type: "offer", sdp: "v=0" };
  assert.deepEqual(decodeSignalPayload(offer), offer);
  assert.deepEqual(decodeSignalPayload(JSON.stringify(offer)), offer);
  assert.deepEqual(decodeSignalPayload(JSON.stringify(JSON.stringify(offer))), offer);
  assert.equal(decodeSignalPayload("not-json"), "not-json");
});
