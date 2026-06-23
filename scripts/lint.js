import { execSync } from "child_process";
const isWin = process.platform === "win32";

const checks = [];
checks.push("typecheck");
if (!isWin) {
  checks.push("lint:logs:std", "lint:rust:std", "lint:feature:boundaries");
} else {
  console.log("Skipping bash-dependent checks on Windows");
}
checks.push("lint:docs");

let exitCode = 0;
for (const check of checks) {
  console.log(`Running ${check}...`);
  try {
    execSync(`npm run -s ${check}`, { stdio: "inherit" });
  } catch (e) {
    console.error(`Check ${check} failed with status ${e.status}`);
    exitCode = 1;
  }
}
process.exit(exitCode);
