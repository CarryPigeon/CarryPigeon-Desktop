# CarryPigeon Desktop Agent Notes

## Stack And Entrypoints
- Tauri 2 desktop app: Vue 3 + TypeScript frontend in `src/`, Rust backend in `src-tauri/`.
- Frontend bootstrap is `src/main.ts`; app composition/routing lives in `src/app/` (`src/app/router.ts` wires feature route exports).
- Rust starts at `src-tauri/src/main.rs` -> `src-tauri/src/lib.rs` -> `src-tauri/src/app/mod.rs`; Tauri commands are registered in `src-tauri/src/app/mod.rs` and implemented under feature `di/commands.rs` files.
- The Rust workspace root is `Cargo.toml`; the only member is `src-tauri`, so use `--manifest-path src-tauri/Cargo.toml` for focused Rust commands.

## Commands
- Install: `pnpm install` (CI uses pnpm 10 and Node `lts/*`).
- Frontend-only dev server: `pnpm run dev` (Vite fixed port `1420`, strict port).
- Full desktop dev: `pnpm run tauri dev` (`tauri.conf.json` runs `pnpm dev` before launching).
- Frontend typecheck: `pnpm run typecheck`.
- Frontend production build: `pnpm run build` (runs `typecheck` first, then `vite build`).
- Full repo lint gate: `pnpm run lint` runs typecheck, frontend log standards, Rust standards, feature boundaries, and markup/style docs checks.
- Tauri bundle: `pnpm run tauri build` (`tauri.conf.json` runs `pnpm build` first).
- Rust tests: `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1` (same as CI).

## Verification Gotchas
- Vitest is configured in `package.json`; run tests with `pnpm run test`.
- Shell lint scripts are Bash scripts under `scripts/`; on Windows they still run through the package scripts as `bash scripts/...`.
- CI quality gate is `pnpm run lint`, `pnpm run build`, Rust tests with one test thread, then `cargo audit` and `cargo deny check`.
- `scripts/check-rust-standards.sh` forbids `unwrap(`, `expect(`, `panic!`, `todo!`, `unimplemented!`, `println!`, `eprintln!`, and `dbg!` in `src-tauri/src`.
- Tauri commands must return `CommandResult<T>`; bare `Result<_, String>` is only allowed in `src-tauri/src/shared/error/mod.rs`.

## Frontend Boundaries
- Cross-feature imports must use stable public entries only: `@/features/<feature>/api`, `api-types`, `routes`, `styles`, `components`, or `public/*` where that feature exposes it.
- If a feature has no public API entry, treat it as having no stable cross-feature surface; do not deep-import its internals.
- `domain/` code must stay Vue/Tauri/browser/protocol agnostic; transport DTOs belong in adapters/data, not domain or public APIs.
- New or refactored features should put assembly/lifecycle caching in `composition/`; `di/` is transitional on the frontend.
- Follow `src/features/AGENTS.md` and feature-local READMEs before changing feature internals.

## Runtime And Mocking
- Mock env is parsed in `src/shared/config/runtime.ts`; `.env.example` documents the supported variables.
- `VITE_USE_MOCK_API=false` forces mock mode `off`; when true, `VITE_MOCK_MODE` is `store` by default or `protocol` when set.
- In mock mode, required-plugin gate checks are disabled unless `VITE_MOCK_DISABLE_REQUIRED_GATE=false`.

## Logging And Style Gates
- Frontend code must use `createLogger(scope)` instead of direct `console.*`; logger messages must start with `Action: <snake_case>` and use approved prefixes from `scripts/check-log-standards.sh`.
- Rust logs use `tracing` with an `action = "..."` field and approved layered prefixes from `scripts/check-rust-standards.sh`.
- Rust comments are Chinese and log text is English; preserve this convention when touching backend files.
- Standalone `.html` body content and style files must start with required doc comments; see `scripts/check-markup-style-docs.mjs`.

## Docs And Scoped Instructions
- Existing scoped instructions matter: `src/AGENTS.md`, `src/features/AGENTS.md`, `src/shared/AGENTS.md`, `src-tauri/AGENTS.md`, and `docs/AGENTS.md`.
- Docs are governed by `docs/README.md` and `docs/文档规范.md`: long-lived docs in `docs/`, design docs in `docs/design/`, API docs in `docs/api/`, temporary material in `docs/tmp/`.
- Do not treat generated output (`dist/`, `target/`, `.vite`, `node_modules`) as source.
