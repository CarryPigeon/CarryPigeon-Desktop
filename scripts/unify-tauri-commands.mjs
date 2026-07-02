import fs from "fs";
import path from "path";

const COMMANDS_FILE = "src/shared/tauri/commands.ts";
const SRC_DIR = "src";

function parseCommandsMap(text) {
  const map = new Map();
  const re = /^\s*([A-Za-z0-9_]+):\s*"((?:[^"\\]|\\.)*)",?$/gm;
  let m;
  while ((m = re.exec(text))) {
    const key = m[1];
    const value = m[2];
    if (map.has(value)) {
      console.warn(`Duplicate command value "${value}" for keys ${map.get(value)} and ${key}`);
    }
    map.set(value, key);
  }
  return map;
}

function escapeRegExp(s) {
  return s.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      walk(p, files);
    } else if (/\.(ts|vue)$/.test(p)) {
      files.push(p);
    }
  }
}

const commandsText = fs.readFileSync(COMMANDS_FILE, "utf8");
const reverseMap = parseCommandsMap(commandsText);

const files = [];
walk(SRC_DIR, files);

const changedFiles = [];
const untouchedMatches = [];

for (const f of files) {
  let text = fs.readFileSync(f, "utf8");
  let replaced = false;

  for (const [value, key] of reverseMap.entries()) {
    const escaped = escapeRegExp(value);
    const re = new RegExp(
      `((?:invoke|invokeTauri)(?:<[^>]*>)?\\s*\\(\\s*)["']${escaped}["']`,
      "g",
    );
    text = text.replace(re, (m, prefix) => {
      replaced = true;
      return `${prefix}TAURI_COMMANDS.${key}`;
    });
  }

  if (replaced) {
    const hasImport = /import\s+.*TAURI_COMMANDS/.test(text);
    if (!hasImport) {
      const directInvokeImport = /import\s+{\s*invoke\s*}\s+from\s+["']@tauri-apps\/api\/core["'];/;
      const invokeTauriImport = /import\s+{\s*invokeTauri\s*}\s+from\s+["']@\/shared\/tauri\/invokeClient["'];/;
      if (directInvokeImport.test(text)) {
        text = text.replace(
          directInvokeImport,
          (m) => `${m}\nimport { TAURI_COMMANDS } from "@/shared/tauri/commands";`,
        );
      } else if (invokeTauriImport.test(text)) {
        text = text.replace(
          invokeTauriImport,
          (m) => `${m}\nimport { TAURI_COMMANDS } from "@/shared/tauri/commands";`,
        );
      } else {
        text = text.replace(
          /^(import\s+[^;]+;\n)/m,
          (m) => `${m}import { TAURI_COMMANDS } from "@/shared/tauri/commands";\n`,
        );
      }
    }
    fs.writeFileSync(f, text);
    changedFiles.push(f);
  }
}

console.log(`Parsed ${reverseMap.size} command names from ${COMMANDS_FILE}`);
console.log(`Scanned ${files.length} files`);
console.log(`Unified strings in ${changedFiles.length} files:`);
for (const f of changedFiles) console.log(`  - ${f}`);
