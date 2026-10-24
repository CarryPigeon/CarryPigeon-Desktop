/**
 * @fileoverview AI 总结「后端」偏好纯逻辑（不依赖 Vue / Tauri / 浏览器 API）。
 * @description
 * 「后端」指生成总结所走的通道：
 * - `client`：插件自配的 AI provider（`ctx.network.fetch` 直连 OpenAI 兼容端点，
 *   密钥由 `ctx.secrets` 存系统凭据管理器、宿主 Rust 侧代为注入请求头）；
 * - `server`：聊天服务端端点 `/api/ai/summarize`；
 * - `auto`：优先自配 provider，未配置（`not-configured`）时回退服务端（历史默认行为）。
 */

/** 总结后端偏好。 */
export type SummarizeBackend = "auto" | "client" | "server";

/** 偏好持久化 key（`ctx.storage` 命名空间按 serverId + pluginId 隔离）。 */
export const SUMMARIZE_BACKEND_STORAGE_KEY = "ai_summary.backend";

/** 合法的后端取值（用于校验与遍历）。 */
export const SUMMARIZE_BACKENDS: readonly SummarizeBackend[] = ["auto", "client", "server"];

/**
 * 插件自配 provider 调用的失败原因分类。
 *
 * - `not-configured`：从未配置 provider（目标为空且未显式选择），应回退服务端端点；
 * - `incomplete-config`：已选 provider 但 base URL / 模型名为空（或没有可总结的消息）；
 * - `api-key-missing`：需要密钥但尚未配置（或安全存储不可用）；
 * - `request-failed`：请求已发出但失败（含上游错误码与传输错误）。
 */
export type ClientAiFailureCode =
  | "not-configured"
  | "incomplete-config"
  | "api-key-missing"
  | "request-failed";

/**
 * 解析持久化值（非法/缺失 → `auto`，即历史默认行为）。
 *
 * @param raw - `ctx.storage.get` 读到的原始值。
 * @returns 归一化后的后端偏好。
 */
export function parseSummarizeBackend(raw: unknown): SummarizeBackend {
  if (typeof raw !== "string") return "auto";
  const value = raw.trim().toLowerCase();
  return (SUMMARIZE_BACKENDS as readonly string[]).includes(value)
    ? (value as SummarizeBackend)
    : "auto";
}

/**
 * 后端偏好 → 本次请求计划。
 *
 * @param mode - 当前后端偏好。
 * @param hasClientProvider - 是否具备自配 provider 的调用条件（`ctx.network` 可用）。
 * @returns 是否使用自配 provider、是否允许回退服务端端点。
 */
export function resolveBackendPlan(
  mode: SummarizeBackend,
  hasClientProvider: boolean,
): { useClient: boolean; allowServerFallback: boolean } {
  if (!hasClientProvider) {
    // 无网络能力（旧宿主/无权限）：无论偏好如何都只能走服务端。
    return { useClient: false, allowServerFallback: true };
  }
  if (mode === "server") return { useClient: false, allowServerFallback: true };
  if (mode === "client") return { useClient: true, allowServerFallback: false };
  return { useClient: true, allowServerFallback: true };
}

/**
 * 判断自配 provider 失败是否应「静默回退服务端」。
 *
 * 规则：仅 `not-configured`（从未配置 provider）且计划允许回退时回退；
 * 已配置但调用失败一律不回退，避免用户误以为自配模型在生效。
 *
 * @param code - provider 调用失败分类。
 * @param plan - 本次请求计划。
 * @returns 需要回退服务端时为 true。
 */
export function shouldFallbackToServer(
  code: ClientAiFailureCode,
  plan: { allowServerFallback: boolean },
): boolean {
  return code === "not-configured" && plan.allowServerFallback;
}
