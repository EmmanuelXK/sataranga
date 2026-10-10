import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(root, { recursive: true });

function png(size, inset) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 4;
      const edge = x < inset || y < inset || x >= size - inset || y >= size - inset;
      const cx = size / 2;
      const cy = size * 0.42;
      const inCrown = Math.abs(x - cx) < size * 0.22 && y > size * 0.28 && y < size * 0.62;
      const inBase = Math.abs(x - cx) < size * 0.28 && y > size * 0.58 && y < size * 0.74;
      const light = !edge && (inCrown || inBase);
      const r = edge ? 0x0e : light ? 0xee : 0x76;
      const g = edge ? 0x0e : light ? 0xee : 0x96;
      const b = edge ? 0x10 : light ? 0xd2 : 0x56;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const chunks = [
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ];
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ...chunks]);
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), data])), 8 + data.length);
  return out;
}

function crc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

writeFileSync(join(root, "icon-192.png"), png(192, 0));
writeFileSync(join(root, "icon-512.png"), png(512, 0));
writeFileSync(join(root, "icon-maskable-512.png"), png(512, 64));
console.log("wrote icons");
