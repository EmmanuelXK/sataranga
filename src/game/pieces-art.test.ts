import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import test from "node:test";

const NAMES = ["raja", "mantri", "hasthi", "ashwa", "ratha", "padati"];

test("piece svgs have no external document type", () => {
  for (const color of ["w", "b"]) {
    for (const name of NAMES) {
      const file = `public/pieces/${color}-${name}.svg`;
      const text = readFileSync(file, "utf8");
      assert.equal(text.includes("<!DOCTYPE"), false, file);
      assert.equal(text.includes("REC-SVG"), false, file);
      assert.ok(text.trimStart().startsWith("<svg"), file);
      assert.ok(text.includes("<path"), file);
    }
  }
});

test("piece rasters used as fallback are 256px and smaller than the 512 sources", () => {
  for (const color of ["w", "b"]) {
    for (const name of NAMES) {
      const source = `public/pieces/${color}-${name}.png`;
      const small = `public/pieces/256/${color}-${name}.png`;
      const buf = readFileSync(small);
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      assert.equal(width, 256, small);
      assert.equal(height, 256, small);
      assert.ok(statSync(small).size < statSync(source).size, small);
    }
  }
  const icons = readdirSync("public/icons");
  assert.ok(icons.includes("apple-touch-icon.png"));
  assert.ok(icons.includes("icon-192.png"));
  assert.ok(icons.includes("icon-512.png"));
  const apple = readFileSync("public/icons/apple-touch-icon.png");
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
});

test("challenge chess pieces are the original SATARANGA Staunton set", () => {
  const about = readFileSync("src/routes/about.tsx", "utf8");
  assert.match(about, /Chess pieces are original SATARANGA artwork by WOW LIFESTYLES\./);
  assert.equal(about.includes("cburnett"), false);
  assert.equal(about.includes("Colin M.L. Burnett"), false);
  for (const file of ["wK", "wQ", "wR", "wB", "wN", "wP", "bK", "bQ", "bR", "bB", "bN", "bP"]) {
    const text = readFileSync(`public/pieces/sataranga-staunton/${file}.svg`, "utf8");
    assert.ok(text.trimStart().startsWith("<svg"), file);
    assert.match(text, /viewBox="0 0 45 45"/, file);
    assert.match(text, /stroke="#2A2420"/, file);
  }
  assert.throws(() => readFileSync("public/pieces/cburnett/CREDITS.md", "utf8"));
});
