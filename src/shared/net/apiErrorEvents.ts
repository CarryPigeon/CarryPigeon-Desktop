/**
 * @fileoverview API 协议错误统一模型（BaseAPI 错误映射 + 事件派发）。
 * @description 统一处理 TCP 协议层错误码，便于展示层提供一致的错误反馈。
 */

/**
 * API 协议错误原因枚举（机器可读）。
 */
export type ApiProtocolErrorReason = "operation_failed" | "permission_denied" | "unknown_error_code";

/**
 * API 协议错误详情（可用于事件通知与 UI 展示）。
 */
export type ApiProtocolErrorDetail = {
  code: number;
  reason: ApiProtocolErrorReason;
  message: string;
};

/**
 * 应用窗口级 API 协议错误事件名。
 *
 * @constant
 */
export const API_PROTOCOL_ERROR_EVENT = "carrypigeon:api-protocol-error";

/**
 * API 协议错误对象。
 */
export class ApiProtocolError extends Error {
  readonly code: number;
  readonly reason: ApiProtocolErrorReason;

  /**
   * @param detail - 错误详情。
   */
  constructor(detail: ApiProtocolErrorDetail) {
    super(detail.message);
    this.name = "ApiProtocolError";
    this.code = detail.code;
    this.reason = detail.reason;
  }
}

/**
 * 将协议错误码映射为机器可读原因。
 *
 * @param code - 协议错误码。
 * @returns 机器可读 reason。
 */
function toReason(code: number): ApiProtocolErrorReason {
  if (code === 100) return "operation_failed";
  if (code === 300) return "permission_denied";
  return "unknown_error_code";
}

/**
 * 将协议错误码映射为用户可读消息。
 *
 * @param code - 协议错误码。
 * @param reason - 机器可读 reason。
 * @returns 用户可读消息。
 */
function toMessage(code: number, reason: ApiProtocolErrorReason): string {
  if (reason === "operation_failed") return "Operation failed on server side.";
  if (reason === "permission_denied") return "Permission denied by server policy.";
  return `Unknown server error code: ${code}`;
}

/**
 * 创建标准化协议错误对象。
 *
 * @param code - 协议错误码。
 * @returns 标准错误对象。
 */
export function createApiProtocolError(code: number): ApiProtocolError {
  const normalizedCode = Number.isFinite(code) ? Math.trunc(code) : -1;
  const reason = toReason(normalizedCode);
  const message = toMessage(normalizedCode, reason);
  return new ApiProtocolError({ code: normalizedCode, reason, message });
}

/**
 * 派发窗口级 API 协议错误事件（best-effort）。
 *
 * @param detail - 错误详情。
 */
export function dispatchApiProtocolError(detail: ApiProtocolErrorDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApiProtocolErrorDetail>(API_PROTOCOL_ERROR_EVENT, { detail }));
}
