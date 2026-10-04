import assert from "node:assert/strict";
import test from "node:test";
import { decodeSignalPayload } from "./p2p.ts";

test("signal payloads decode one or two layers of JSON text", () => {
  const offer = { type: "offer", sdp: "v=0" };
  assert.deepEqual(decodeSignalPayload(offer), offer);
  assert.deepEqual(decodeSignalPayload(JSON.stringify(offer)), offer);
  assert.deepEqual(decodeSignalPayload(JSON.stringify(JSON.stringify(offer))), offer);
  assert.equal(decodeSignalPayload("not-json"), "not-json");
});
