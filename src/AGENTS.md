# Frontend root

## OVERVIEW
`src/` is the Vue/WebView application root. `src/main.ts` is the browser bootstrap, while `src/app/` owns orchestration and `src/features/` owns feature boundaries.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| App bootstrap | `src/main.ts` | Mounts Vue, applies theme, starts bridges |
| Routing | `src/app/router.ts` | Aggregates feature page entry points |
| Orchestration | `src/app/bootstrap/`, `src/app/processes/` | Session and subwindow startup logic |
| Feature code | `src/features/` | Feature-first modules |
| Shared code | `src/shared/` | Cross-feature utilities, UI, and infrastructure |

## CONVENTIONS
- Keep startup logic out of feature folders.
- Treat `src/main.ts` as assembly code; move reusable flow into `src/app/`.
- Prefer feature public entrypoints over direct path imports.

## ANTI-PATTERNS
- Don’t add ad hoc global state in `src/main.ts`.
- Don’t import deep feature internals from the router or bootstrap layer.
