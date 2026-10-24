/**
 * @fileoverview ai-summary 插件入口（Cordis v2 契约）。
 * @description
 * 面板型插件：挂载 AI 总结浮层（AiSummaryHost），注册工具栏入口转发 summarize 动作，
 * 并通过 `ctx.ui.registerSettingsItem` 在宿主设置页「插件设置」分区提供两组设置：
 * - 「AI 摘要后端」（自动 / 仅自配 AI / 仅服务端）；
 * - 「AI 服务提供方」（provider / base URL / 模型 / API Key / 采样参数，自管配置）。
 * AI 能力完全由插件自管：provider 配置存 `ctx.storage`，API Key 经 `ctx.secrets`
 * 存系统凭据管理器，OpenAI 兼容请求经 `ctx.network.fetch`（外源需 `network:external`）直连。
 * 无消息渲染器。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { ToolbarAction } from "@/features/plugins/api-types";
import type { Context } from "@/features/plugins/sdk";
import { aiSummaryManifest } from "./manifest";
import { bindContext, unbindContext } from "./host/bridge";
import { ensureBackendLoaded } from "./host/backendPreference";
import { ensureProviderLoaded } from "./host/providerConfig";
import { createLogger } from "./shared/logger";
import { t } from "./i18n";
import AiSummaryHost from "./components/AiSummaryHost.vue";
import AiSummarySettings from "./components/AiSummarySettings.vue";
import AiProviderSettings from "./components/AiProviderSettings.vue";

const logger = createLogger("plugin");

export const name = "ai-summary";
export const manifest = aiSummaryManifest;
export const inject = ["ui", "network", "secrets", "messages", "storage", "server"];

// 工具栏入口图标：复用宿主 TDesign 全局 Icon 组件（与宿主共享同一运行时实例）。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `AiSummaryToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
// ai-article（带笔的文档）：贴合「AI 把频道消息汇总成摘要文档」的语义；
// 原 city-12 是城市天际线，与功能无关。
const SummaryIcon = makeIcon("ai-article");

export function apply(ctx: Context): void {
  bindContext(ctx);
  ctx.on("dispose", () => unbindContext());

  // 后端偏好与 provider 配置：提前载入，保证面板首次总结前已按用户选择生效。
  void ensureBackendLoaded();
  void ensureProviderLoaded();

  // 挂载 AI 总结浮层（AiSummaryHost），捕获实例供工具栏点击转发 summarize 动作。
  const overlayHandle =
    ctx.ui?.mountOverlay(AiSummaryHost, {}) ?? { unmount: () => {}, instance: null };

  // 工具栏点击：转发到面板 exposed 的 summarize(channelId)。
  function openPanel(chatCtx: { channelId: string }): void {
    const host = overlayHandle.instance as {
      summarize?: (channelId: string) => Promise<void>;
    } | null;
    if (!host?.summarize) {
      logger.warn("ai_summary_toolbar_host_missing");
      return;
    }
    void host.summarize(chatCtx.channelId);
  }

  const action: ToolbarAction = {
    id: "ai-summary.open",
    label: "",
    icon: SummaryIcon,
    order: 62,
    onClick: (c) => openPanel(c),
  };

  ctx.ui?.registerToolbarAction(action);

  // 设置项：宿主设置页「插件设置」分区中的「AI 摘要后端」选择。
  // 兼容旧宿主（无该能力）：运行时先做 typeof 守卫，避免旧客户端上直接抛错导致插件加载失败。
  if (typeof ctx.ui?.registerSettingsItem === "function") {
    ctx.ui.registerSettingsItem({
      id: "backend",
      title: t("ai_summary_settings_title"),
      description: t("ai_summary_settings_desc"),
      keywords: ["ai", "backend", "provider", "server", "client", "后端", "服务端", "自配", "模型"],
      order: 10,
      component: AiSummarySettings,
    });

    // 设置项：自管 AI provider 配置（从宿主「AI 服务」设置迁移）。
    ctx.ui.registerSettingsItem({
      id: "provider",
      title: t("ai_settings_title"),
      description: t("ai_settings_desc"),
      keywords: [
        "ai", "provider", "model", "api key", "openai", "deepseek", "dashscope", "moonshot", "ollama",
        "模型", "服务商", "密钥", "本地模型", "自定义",
      ],
      order: 20,
      component: AiProviderSettings,
    });
  } else {
    logger.warn("ai_summary_settings_item_unsupported");
  }
}
