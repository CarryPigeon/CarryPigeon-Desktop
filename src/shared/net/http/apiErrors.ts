/**
 * @fileoverview API error models (HTTP JSON error envelope).
 * @description
 * This module defines the single error shape the client expects from the HTTP API.
 *
 * Why this exists:
 * - Keep error parsing logic out of UI and feature stores.
 * - Ensure all callers can branch on `reason` (machine-readable), not `message`.
 *
 * API doc reference:
 * - See `docs/api/*` error model and reason enumeration
 */

/**
 * Machine-readable error payload returned by the server for non-2xx HTTP responses.
 */
export type ApiErrorEnvelope = {
  error: {
    /**
     * HTTP status code mirror (e.g. 401/403/409/412/422/500).
     */
    status: number;
    /**
     * Machine-readable reason string used for client branching.
     */
    reason: string;
    /**
     * Human-readable message for UI toasts (not a stable branching key).
     */
    message?: string;
    /**
     * Optional request id for tracing on the server side.
     */
    request_id?: string;
    /**
     * Optional extra data (field errors, missing plugins, retry hints, etc.).
     */
    details?: Record<string, unknown>;
  };
};

/**
 * Parsed error instance thrown by the HTTP client wrapper.
 *
 * Notes:
 * - This extends `Error` so it can be caught normally.
 * - It preserves `status/reason/details` for programmatic handling.
 */
export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly reason: string;
  public readonly requestId: string;
  public readonly details: Record<string, unknown>;

  /**
   * Construct a request error from a parsed envelope.
   *
   * @param envelope - Parsed API error envelope.
   */
  constructor(envelope: ApiErrorEnvelope) {
    const message = envelope.error.message || envelope.error.reason || "request_failed";
    super(message);
    this.name = "ApiRequestError";
    this.status = envelope.error.status;
    this.reason = envelope.error.reason;
    this.requestId = envelope.error.request_id ?? "";
    this.details = (envelope.error.details ?? {}) as Record<string, unknown>;
  }
}

/**
 * Type guard for `ApiRequestError`.
 *
 * @param e - Unknown caught error.
 * @returns `true` when `e` is an `ApiRequestError`.
 */
export function isApiRequestError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError;
}
