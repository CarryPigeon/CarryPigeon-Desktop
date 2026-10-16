/**
 * @fileoverview AI 总结「后端」偏好纯逻辑（不依赖 Vue / Tauri / 浏览器 API）。
 * @description
 * 「后端」指生成总结所走的通道：
 * - `client`：宿主客户端 AI（`ctx.ai.summarize`，用户自配 provider，密钥由宿主代持）；
 * - `server`：聊天服务端端点 `/api/ai/summarize`；
 * - `auto`：优先客户端 AI，未配置（`not-configured`）时回退服务端（历史默认行为）。
 *
 * 说明：插件无法选择具体 provider / 模型——`ctx.ai` 只暴露 `isConfigured` / `summarize`，
 * provider 与采样参数由宿主「设置 → AI 服务」独占。
 */

import type { PluginAiFailureCode } from "@/features/plugins/api-types";

/** 总结后端偏好。 */
export type SummarizeBackend = "auto" | "client" | "server";

/** 偏好持久化 key（`ctx.storage` 命名空间按 serverId + pluginId 隔离）。 */
export const SUMMARIZE_BACKEND_STORAGE_KEY = "ai_summary.backend";

/** 合法的后端取值（用于校验与遍历）。 */
export const SUMMARIZE_BACKENDS: readonly SummarizeBackend[] = ["auto", "client", "server"];

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
 * @param hasClientAi - 宿主是否注入 `ctx.ai`（旧宿主/无权限时为 false）。
 * @returns 是否使用客户端 AI、是否允许回退服务端端点。
 */
export function resolveBackendPlan(
  mode: SummarizeBackend,
  hasClientAi: boolean,
): { useClient: boolean; allowServerFallback: boolean } {
  if (!hasClientAi) {
    // 无客户端 AI 能力：无论偏好如何都只能走服务端。
    return { useClient: false, allowServerFallback: true };
  }
  if (mode === "server") return { useClient: false, allowServerFallback: true };
  if (mode === "client") return { useClient: true, allowServerFallback: false };
  return { useClient: true, allowServerFallback: true };
}

/**
 * 判断客户端 AI 失败是否应「静默回退服务端」。
 *
 * 规则：仅 `not-configured`（用户选择跟随服务端 / 未配置客户端 provider）且计划允许回退时回退；
 * 已配置但调用失败一律不回退，避免用户误以为自配模型在生效。
 *
 * @param code - 客户端 AI 失败分类。
 * @param plan - 本次请求计划。
 * @returns 需要回退服务端时为 true。
 */
export function shouldFallbackToServer(
  code: PluginAiFailureCode,
  plan: { allowServerFallback: boolean },
): boolean {
  return code === "not-configured" && plan.allowServerFallback;
}
