// PGLite loads pglite.wasm / pglite.data / initdb.wasm beside its module.
// The server bundle inlines the JS but not those files, so a preview with no
// DATABASE_URL crashes on boot. Copy them next to the traced module.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const destDir = join(process.cwd(), ".vercel/output/functions/__server.func/_libs");
const srcDir = join(process.cwd(), "node_modules/@electric-sql/pglite/dist");
const files = ["pglite.data", "pglite.wasm", "initdb.wasm"];

if (!existsSync(destDir)) {
  console.log("[pglite] no server bundle yet, skipping asset copy");
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
for (const name of files) {
  copyFileSync(join(srcDir, name), join(destDir, name));
}
console.log("[pglite] copied wasm assets next to the server bundle");
