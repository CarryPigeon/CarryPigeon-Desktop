/**
 * @fileoverview ai-summary 插件入口（Cordis v2 契约）。
 * @description
 * 面板型插件：挂载 AI 总结浮层（AiSummaryHost），并注册工具栏入口转发 summarize 动作。
 * 无消息渲染器。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { ToolbarAction } from "@/features/plugins/api-types";
import type { Context } from "@/features/plugins/sdk";
import { aiSummaryManifest } from "./manifest";
import { bindContext, unbindContext } from "./host/bridge";
import { createLogger } from "./shared/logger";
import AiSummaryHost from "./components/AiSummaryHost.vue";

const logger = createLogger("plugin");

export const name = "ai-summary";
export const manifest = aiSummaryManifest;
export const inject = ["ui", "ai", "messages", "network", "storage", "server"];

// 工具栏入口图标：复用宿主 TDesign 全局 Icon 组件（与宿主共享同一运行时实例）。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `AiSummaryToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
const SummaryIcon = makeIcon("city-12");

export function apply(ctx: Context): void {
  bindContext(ctx);
  ctx.on("dispose", () => unbindContext());

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
}
