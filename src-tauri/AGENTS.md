# Rust / Tauri root

## OVERVIEW
`src-tauri/` is the Rust backend and Tauri shell. `src-tauri/src/main.rs` and `src-tauri/src/lib.rs` start the app; `src-tauri/src/app/` owns builder composition and command registration.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| App startup | `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/app/mod.rs` | Tauri entry chain |
| Backend features | `src-tauri/src/features/` | Feature modules and command surfaces |
| Shared backend code | `src-tauri/src/shared/` | DB/log/error/net helpers |
| Tauri config | `tauri.conf.json`, `Cargo.toml` | Build and runtime config |

## CONVENTIONS
- Rust modules use `mod.rs` exports and nested `domain/`, `data/`, `usecases/`, `di/` structure.
- Exposed Tauri commands live in `di/commands.rs`.
- Comments are Chinese; tracing log text is English.

## ANTI-PATTERNS
- Don’t use panic-prone patterns in commands or shared backend flows.
- Don’t introduce frontend-style `public/` conventions here; the Rust surface is command-based.
