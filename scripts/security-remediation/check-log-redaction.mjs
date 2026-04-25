#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rootDir = process.cwd();
const corePath = path.join(rootDir, "src", "shared", "tauri", "tauriLogCore.ts");

const source = fs.readFileSync(corePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: corePath,
});

const module = { exports: {} };
const context = vm.createContext({ module, exports: module.exports, console });
vm.runInContext(outputText, context, { filename: corePath });

const { buildMessage, normalizeActionMessage, redactLogMeta } = module.exports;

const redactedMeta = redactLogMeta({
  authorization: "Bearer abc.def.ghi",
  password: "p@ssw0rd",
  verificationCode: "123456",
  nested: { token: "nested-token", detail: "Bearer zyx" },
});

const rendered = buildMessage("Action: network_login_failed", redactedMeta);

if (normalizeActionMessage("Action: NetworkLoginFailed") !== "Action: network_login_failed") {
  throw new Error("action normalization changed unexpectedly");
}

if (!rendered.includes("[REDACTED]")) {
  throw new Error("bearer token was not redacted");
}

if (!rendered.includes('"password":"[REDACTED]"')) {
  throw new Error("password was not redacted");
}

if (!rendered.includes('"verificationCode":"[REDACTED]"')) {
  throw new Error("verification code was not redacted");
}

if (!rendered.includes('"nested":{"token":"[REDACTED]","detail":"[REDACTED]"}')) {
  throw new Error("nested redaction was not applied");
}

console.log("PASS frontend-log-redaction");
console.log(rendered);
