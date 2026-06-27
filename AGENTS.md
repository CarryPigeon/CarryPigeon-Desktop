# CarryPigeon Desktop — Agent Guide

Cross-platform chat client: **Tauri 2 + Rust + Vue 3 + TypeScript + Vite 8**.
UI: TDesign Vue Next (auto-imported). i18n: vue-i18n (zh_cn default). Package manager: pnpm.

## Commands

```bash
pnpm install                # Install deps
pnpm run dev                # Frontend-only dev server (port 1420, strict)
pnpm run tauri dev          # Full Tauri desktop app
pnpm run build              # typecheck + vite build
pnpm run typecheck          # vue-tsc --noEmit
pnpm run lint               # All lint checks (typecheck + feature boundaries + rust std + logs + docs + color literals)
pnpm run test               # Vitest (jsdom, src/**/*.test.ts)
pnpm run tauri build        # Production Tauri bundle

# Rust backend (single-threaded — required due to SQLite)
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
```

## Lint notes

- On Windows, `pnpm run lint` skips bash-dependent checks (`lint:feature:boundaries`, `lint:logs:std`, `lint:rust:std`). Run them via Git Bash or WSL.
- Feature boundary violations are enforced by `scripts/check-feature-boundaries.sh`.

## Architecture

**Frontend** (`src/`): Feature-first + Clean Layers. See `src/AGENTS.md`, `src/features/AGENTS.md`, `src/shared/AGENTS.md`.

- Path alias: `@` → `src/`
- TDesign components/composables auto-imported — no manual import needed
- `import.meta.env.PACKAGE_VERSION` injected from `package.json`

**Backend** (`src-tauri/`): Rust/Tauri. See `src-tauri/AGENTS.md`.

- Error handling: `CommandResult<T>` (defined in `src-tauri/src/shared/error/mod.rs`)
- Internal layers use `anyhow::Result<T>`; mapping to `CommandResult` happens at `di/commands` boundary

## Key constraints

- **Vite dev server port 1420 is strict** — Tauri expects this exact port
- **Rust tests must run single-threaded** (`--test-threads=1`) due to shared SQLite
- **Comments are Chinese; log messages are English**
- Cross-feature imports only through `@/features/<name>/api` or `api-types` — never deep internals
- `domain/` must NOT depend on Vue, Tauri, or browser APIs
- All `#[tauri::command]` must return `CommandResult<T>`
- No panic-prone patterns (`unwrap`, `expect`, `panic!`, `todo!`) in production Rust code
- New Tauri commands must be registered in `invoke_handler!` in `src-tauri/src/app/mod.rs`

## Mock / env

Copy `.env.example` to `.env`. Key vars: `VITE_USE_MOCK_API`, `VITE_MOCK_MODE` (`store`|`protocol`), `VITE_MOCK_LATENCY_MS`.

## CI

Pushes to `master`/`release`: `pnpm lint` → `pnpm build` → `cargo test` → `cargo audit` → `cargo deny check` → cross-platform Tauri build → draft release.

## Docs

All docs in `docs/` are in Chinese. Key: `docs/架构设计.md`, `docs/Feature模块设计规范.md`, `docs/客户端开发指南.md`.
