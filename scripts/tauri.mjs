import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.platform === "win32") {
  // 避免 MSVC lib.exe 在用户临时目录中创建归档临时文件时触发 LNK1104。
  const buildTemp = fileURLToPath(new URL("../target/tauri-tmp", import.meta.url));
  mkdirSync(buildTemp, { recursive: true });
  process.env.TEMP = buildTemp;
  process.env.TMP = buildTemp;
}

await import("@tauri-apps/cli/tauri.js");
