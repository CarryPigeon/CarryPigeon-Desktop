/**
 * @fileoverview AuthErrors.ts
 * @description Auth domain error models (framework-agnostic).
 */

export type RequiredPluginMissingPayload = {
  reason: "required_plugin_missing";
  missing_plugins: string[];
};

export class AuthRequiredPluginMissingError extends Error {
  constructor(public readonly payload: RequiredPluginMissingPayload) {
    super("required_plugin_missing");
    this.name = "AuthRequiredPluginMissingError";
  }
}

/**
 * Type guard for `AuthRequiredPluginMissingError`.
 *
 * @param e - Unknown caught error.
 * @returns `true` when `e` is an instance of `AuthRequiredPluginMissingError`.
 */
export function isAuthRequiredPluginMissingError(e: unknown): e is AuthRequiredPluginMissingError {
  return e instanceof AuthRequiredPluginMissingError;
}
