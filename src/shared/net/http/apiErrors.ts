/**
 * @fileoverview API 错误模型（HTTP JSON 错误信封）。
 * @description 网络基础设施：apiErrors。
 * 本模块定义了客户端从 HTTP API 侧期望接收到的统一错误结构。
 *
 * 目的：
 * - 将错误解析逻辑从 UI/业务 store 中抽离；
 * - 强制调用方优先基于 `reason`（机器可读）分支，而不是基于 `message`（非稳定）。
 *
 * 接口文档参考：
 * - 参见 `docs/api/*`（错误模型与 reason 枚举）。
 */

/**
 * 服务端在非 2xx HTTP 响应中返回的错误载荷（机器可读）。
 */
export type ApiErrorEnvelope = {
  error: {
    /**
     * HTTP 状态码镜像（例如 401/403/409/412/422/500）。
     */
    status: number;
    /**
     * 机器可读 reason 字符串（用于客户端分支判断）。
     */
    reason: string;
    /**
     * 人类可读 message（用于 UI toast；不作为稳定分支 key）。
     */
    message?: string;
    /**
     * 可选 request id（用于服务端侧链路追踪）。
     */
    request_id?: string;
    /**
     * 可选扩展数据（字段错误、缺失插件、重试提示等）。
     */
    details?: Record<string, unknown>;
  };
};

/**
 * HTTP 客户端封装层抛出的错误实例（携带 status/reason/details）。
 *
 * 说明：
 * - 继承 `Error`，便于常规 catch；
 * - 保留 `status/reason/details` 以便程序化处理。
 */
export class ApiRequestError extends Error {
  public readonly status: number;
  public readonly reason: string;
  public readonly requestId: string;
  public readonly details: Record<string, unknown>;

  /**
   * 通过已解析的错误信封构造请求错误。
   *
   * @param envelope - 已解析的 API 错误信封。
   */
  constructor(envelope: ApiErrorEnvelope) {
    const parsed = parseApiErrorEnvelope(envelope, envelope.error?.status ?? 0);
    const message = parsed.error.message || parsed.error.reason || "request_failed";
    super(message);
    this.name = "ApiRequestError";
    this.status = parsed.error.status;
    this.reason = parsed.error.reason;
    this.requestId = parsed.error.request_id ?? "";
    this.details = (parsed.error.details ?? {}) as Record<string, unknown>;
  }
}

/**
 * 将未知 JSON 错误体归一化为 CarryPigeon 错误信封。
 *
 * 兼容：
 * - 标准信封 `{ error: { status, reason, message, request_id, details } }`
 * - Spring Boot 默认 404 `{ status, error: "Not Found", path, timestamp }`
 */
export function parseApiErrorEnvelope(raw: unknown, fallbackStatus = 0): ApiErrorEnvelope {
  const fallback: ApiErrorEnvelope = {
    error: {
      status: Number.isFinite(fallbackStatus) ? Math.trunc(fallbackStatus) : 0,
      reason: "http_error",
      message: `HTTP ${fallbackStatus}`,
    },
  };
  if (!raw || typeof raw !== "object") return fallback;

  const rec = raw as Record<string, unknown>;
  const inner = rec.error;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const e = inner as Record<string, unknown>;
    const statusRaw = Number(e.status ?? fallbackStatus);
    const status = Number.isFinite(statusRaw) ? Math.trunc(statusRaw) : fallback.error.status;
    const reason = String(e.reason ?? "").trim() || "http_error";
    const message = typeof e.message === "string" && e.message.trim() ? e.message : reason;
    const requestId = typeof e.request_id === "string" ? e.request_id : undefined;
    const details = e.details && typeof e.details === "object" && !Array.isArray(e.details)
      ? (e.details as Record<string, unknown>)
      : undefined;
    return {
      error: {
        status,
        reason,
        message,
        request_id: requestId,
        details,
      },
    };
  }

  // Spring MVC 未命中路由时返回默认错误 JSON，error 是字符串而不是对象。
  const springStatusRaw = Number(rec.status ?? fallbackStatus);
  const springStatus = Number.isFinite(springStatusRaw) ? Math.trunc(springStatusRaw) : fallback.error.status;
  if (typeof inner === "string" || typeof rec.path === "string") {
    const springError = typeof inner === "string" ? inner.trim() : "";
    return {
      error: {
        status: springStatus,
        reason: springStatus === 404 ? "not_found" : "http_error",
        message: springError || `HTTP ${springStatus}`,
        details: {
          path: rec.path,
          timestamp: rec.timestamp,
        },
      },
    };
  }

  return fallback;
}

/**
 * `ApiRequestError` 的类型守卫。
 *
 * @param e - 捕获到的未知错误。
 * @returns `e` 为 `ApiRequestError` 时返回 `true`。
 */
export function isApiRequestError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError;
}
