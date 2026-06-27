# Feature modules

## OVERVIEW
`src/features/` is a feature-first boundary layer. Each feature should remain self-contained and expose only stable public entrypoints.

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Public API | `api.ts`, `api-types.ts`, `public/*` | Stable cross-feature surface |
| Route entry | `routes.ts`, `public/routes.ts` | Page-level exports for `src/app/router.ts` |
| Composition | `composition/`, `application/` | Assembly and orchestration |
| Domain | `domain/` | No Vue/Tauri/browser deps |
| Adapters | `data/`, `mock/`, `integration/` | External access and controlled integrations |
| Validation | `typechecks/` | Compile-time contract checks |

## CONVENTIONS
- Prefer capability-style public APIs.
- Keep `domain/` pure and protocol-agnostic.
- `di/` is transitional; prefer `composition/` for new work.
- `public/` is the stable cross-feature boundary where present.

## ANTI-PATTERNS
- Don’t import another feature’s internal files.
- Don’t leak transport DTOs into domain models.
- Don’t mix old and new boundary styles unless the feature already does so.
