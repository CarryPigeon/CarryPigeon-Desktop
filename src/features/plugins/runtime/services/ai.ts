/**
 * @fileoverview plugins 运行时能力服务：ai。
 */

import { getAiCapabilities } from "@/features/ai/api";
import { createLogger } from "@/shared/utils/logger";
import { isGuardDisposed, type RuntimeGuard } from "../guard";
import type { PluginAiService } from "../types";

const logger = createLogger("plugin-ai-service");

/**
 * 创建"权限受控"的 ai 服务（客户端可替换 AI provider，密钥由宿主代持）。
 *
 * 说明：
 * - 只暴露 `isConfigured` / `summarize` 两个窄能力，插件无法用任意提示词把客户端当作
 *   通用 LLM 代理，也无法读取 API Key；
 * - guard 已销毁时：`isConfigured` 返回 false、`summarize` 返回 `not-configured`，
 *   让插件自然回退到服务端端点。
 *
 * @param pluginId 插件标识（日志定位）。
 * @param guard 运行时守卫。
 */
export function createAiService(pluginId: string, guard: RuntimeGuard): PluginAiService {
  const notConfigured = {
    ok: false as const,
    code: "not-configured" as const,
    error: "client ai provider is not configured",
  };
  return {
    async isConfigured(): Promise<boolean> {
      if (isGuardDisposed(guard, "ai.isConfigured", pluginId)) return false;
      try {
        return (await getAiCapabilities().getStatus()).ready;
      } catch (error) {
        logger.warn("Action: plugins_ai_status_failed", { pluginId, error: String(error) });
        return false;
      }
    },
    async summarize(input) {
      if (isGuardDisposed(guard, "ai.summarize", pluginId)) return notConfigured;
      const channelId = String(input?.channelId ?? "").trim();
      const messages = Array.isArray(input?.messages) ? input.messages.map((m) => String(m ?? "")) : [];
      try {
        return await getAiCapabilities().summarize(channelId, messages);
      } catch (error) {
        // capability 内部已做错误归一化；此处兜底 IPC 层异常，避免异常穿透插件运行时。
        logger.warn("Action: plugins_ai_summarize_failed", { pluginId, error: String(error) });
        return { ok: false, code: "request-failed", error: String(error) };
      }
    },
  };
}
