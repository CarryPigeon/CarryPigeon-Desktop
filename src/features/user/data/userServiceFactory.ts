/**
 * @fileoverview userServiceFactory.ts
 * @description Data-layer factory: re-exports for backward compatibility.
 *
 * @deprecated Use domain/ports and di/ instead.
 *
 * API alignment:
 * - User read endpoints live under `docs/api/*` → Users
 * - Profile mutation endpoints are not part of the current HTTP API (kept as future/legacy hooks)
 */

// Re-export types from domain layer for backward compatibility
export type { UserMe, UserPublic } from "../domain/types/UserTypes";

// Re-export port type as service type for backward compatibility
export type { UserServicePort as UserService } from "../domain/ports/UserServicePort";

// Re-export factory function for backward compatibility
export { createUserService } from "../di/user.di";
