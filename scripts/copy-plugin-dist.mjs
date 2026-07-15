import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../");
const src = resolve(root, "plugins/voice-call/dist");
const dest = resolve(root, "public/plugins/voice-call");

if (!existsSync(src)) {
  console.error(
    "[copy-plugin-dist] plugins/voice-call/dist not found; run `pnpm plugins:build:voice-call` first",
  );
  process.exit(1);
}

mkdirSync(dirname(dest), { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`[copy-plugin-dist] copied ${src} -> ${dest}`);
