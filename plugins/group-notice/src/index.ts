/**
 * @fileoverview group-notice 插件入口（Cordis v2 契约）。
 * @description
 * - 注册 `group_notice` domain 渲染器；
 * - 挂载通知面板浮层（GroupNoticeHost），并注册工具栏入口转发「打开/刷新」动作。
 */

import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { ToolbarAction } from "@/features/plugins/api-types";
import type { Context } from "@/features/plugins/sdk";
import { groupNoticeManifest } from "./manifest";
import { bindContext, unbindContext } from "./host/bridge";
import { createLogger } from "./shared/logger";
import GroupNoticeBubble from "./components/GroupNoticeBubble.vue";
import GroupNoticeHost from "./components/GroupNoticeHost.vue";

const logger = createLogger("plugin");

export const name = "group-notice";
export const manifest = groupNoticeManifest;
export const inject = ["ui", "network", "storage", "domains", "server"];

// 工具栏入口图标：复用宿主 TDesign 全局 Icon 组件（与宿主共享同一运行时实例）。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `GroupNoticeToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
const NoticeIcon = makeIcon("notification");

export function apply(ctx: Context): void {
  bindContext(ctx);
  ctx.on("dispose", () => unbindContext());

  // 消息 domain 渲染器：group_notice 消息按 level 着色渲染卡片。
  ctx.domains.renderer("group_notice", GroupNoticeBubble);

  // 挂载通知面板浮层（GroupNoticeHost）；overlay 生命周期由 ui 服务随其 fiber 自动清理。
  const overlayHandle =
    ctx.ui?.mountOverlay(GroupNoticeHost, {}) ?? { unmount: () => {}, instance: null };

  // 工具栏点击：打开并刷新当前频道的通知面板。
  function openPanel(chatCtx: { channelId: string }): void {
    const host = overlayHandle.instance as { refresh?: (channelId: string) => Promise<void> } | null;
    if (!host?.refresh) {
      logger.warn("group_notice_toolbar_host_missing");
      return;
    }
    void host.refresh(chatCtx.channelId);
  }

  const action: ToolbarAction = {
    id: "group-notice.open",
    label: "",
    icon: NoticeIcon,
    order: 61,
    onClick: (c) => openPanel(c),
  };

  ctx.ui?.registerToolbarAction(action);
}
