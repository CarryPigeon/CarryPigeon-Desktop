# Shared frontend code

## OVERVIEW
`src/shared/` holds cross-feature infrastructure, helpers, and primitives. It mixes UI atoms, platform adapters, utilities, and transport helpers.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Utilities | `utils/` | Generic helpers and state primitives |
| Platform | `platform/` | Tauri/window integration and ports |
| Networking | `net/` | TCP/WS/TLS/auth helpers |
| Storage/DB | `db/`, `config/` | Local persistence and runtime mode |
| UI primitives | `ui/` | Reusable components |

## CONVENTIONS
- Keep shared code cross-feature and dependency-light.
- `platform/`, `net/`, and `db/` are infrastructure; keep domain logic out of them.

## ANTI-PATTERNS
- Don’t add feature-specific behavior here.
- Don’t create a second copy of a feature API in `shared/`.
