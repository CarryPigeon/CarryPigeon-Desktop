import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const nativeRequire = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveFilePath(inputPath) {
  const candidates = path.extname(inputPath)
    ? [inputPath]
    : [".ts", ".tsx", ".js", ".mjs", ".cjs"].map((ext) => `${inputPath}${ext}`);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Cannot resolve module path: ${inputPath}`);
}

function resolveImportedPath(parentPath, specifier) {
  if (specifier.startsWith("@/")) {
    return resolveFilePath(path.join(projectRoot, "src", specifier.slice(2)));
  }
  if (specifier.startsWith(".") || specifier.startsWith("..")) {
    return resolveFilePath(path.resolve(path.dirname(parentPath), specifier));
  }
  return specifier;
}

function loadTsModule(filePath) {
  const resolvedPath = resolveFilePath(filePath);
  const cached = moduleCache.get(resolvedPath);
  if (cached) return cached.exports;

  const source = fs.readFileSync(resolvedPath, "utf8");
  const outputText = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
    },
  }).outputText;

  const module = { exports: {} };
  moduleCache.set(resolvedPath, module);

  const localRequire = (specifier) => {
    if (specifier === "@/shared/net/http/authedHttpJsonClient") {
      return {
        createAuthedHttpJsonClient() {
          return { requestJson() { throw new Error("unexpected requestJson call"); } };
        },
      };
    }
    if (specifier === "@/shared/config/runtime") {
      return { USE_MOCK_TRANSPORT: false };
    }
    if (specifier === "@/shared/file-transfer/buildFileDownloadUrl") {
      return { buildFileDownloadUrl() { return ""; } };
    }
    const resolved = resolveImportedPath(resolvedPath, specifier);
    if (typeof resolved !== "string" || !resolved.startsWith(projectRoot)) {
      return nativeRequire(specifier);
    }
    return loadTsModule(resolved);
  };

  const wrapper = new Function("require", "module", "exports", "__filename", "__dirname", outputText);
  wrapper(localRequire, module, module.exports, resolvedPath, path.dirname(resolvedPath));
  return module.exports;
}

async function run() {
  const { httpPerformFileUpload } = loadTsModule(path.join(projectRoot, "src/shared/file-transfer/httpFileApi.ts"));
  const caseName = (() => {
    const idx = process.argv.indexOf("--case");
    return idx >= 0 ? String(process.argv[idx + 1] ?? "") : "all";
  })();

  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? "", headers: init?.headers ?? {} });
    return { ok: true, status: 204 };
  };

  try {
    if (caseName === "same-origin" || caseName === "all") {
      calls.length = 0;
      await httpPerformFileUpload(
        "https://example.com",
        { method: "PUT", url: "https://example.com/upload/file", expires_at: 0 },
        new ArrayBuffer(0),
      );
      if (calls.length !== 1 || calls[0].url !== "https://example.com/upload/file") {
        throw new Error(`same-origin fetch mismatch: ${JSON.stringify(calls)}`);
      }
      console.log("PASS same-origin");

      calls.length = 0;
      await httpPerformFileUpload(
        "https://example.com",
        { method: "PUT", url: "/upload/file", expires_at: 0 },
        new ArrayBuffer(0),
      );
      if (calls.length !== 1 || calls[0].url !== "https://example.com/upload/file") {
        throw new Error(`relative URL fetch mismatch: ${JSON.stringify(calls)}`);
      }
      console.log("PASS relative-resolves-against-origin");
    }

    if (caseName === "cross-origin-rejected" || caseName === "all") {
      calls.length = 0;
      let rejected = false;
      try {
        await httpPerformFileUpload(
          "https://example.com",
          { method: "PUT", url: "https://evil.example/upload", expires_at: 0 },
          new ArrayBuffer(0),
        );
      } catch (error) {
        rejected = String(error?.message ?? error).includes("Invalid upload.url");
      }
      if (!rejected) {
        throw new Error("cross-origin upload was not rejected");
      }
      if (calls.length !== 0) {
        throw new Error(`cross-origin upload reached fetch: ${JSON.stringify(calls)}`);
      }
      console.log("PASS cross-origin-rejected-before-fetch");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error?.stack ?? String(error));
  process.exitCode = 1;
});
