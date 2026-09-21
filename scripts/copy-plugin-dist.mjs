import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../");

// 插件 id 列表：无参数时复制全部；传参时仅复制指定插件。
const ALL_PLUGIN_IDS = ["voice-call", "theme", "markdown", "group-notice", "ai-summary"];
const pluginIds = process.argv.slice(2).filter(Boolean);
const targets = pluginIds.length > 0 ? pluginIds : ALL_PLUGIN_IDS;

let failed = false;
for (const pluginId of targets) {
  const src = resolve(root, `plugins/${pluginId}/dist`);
  const dest = resolve(root, `public/plugins/${pluginId}`);
  if (!existsSync(src)) {
    console.error(
      `[copy-plugin-dist] plugins/${pluginId}/dist not found; run \`pnpm plugins:build:${pluginId}\` first`,
    );
    failed = true;
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-plugin-dist] copied ${src} -> ${dest}`);
}

if (failed) process.exit(1);
