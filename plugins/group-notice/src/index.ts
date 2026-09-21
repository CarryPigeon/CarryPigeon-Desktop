import { h, defineComponent } from "vue";
import { Icon } from "tdesign-vue-next";
import type { Component } from "vue";
import type { PluginContext, ToolbarAction } from "@/features/plugins/api-types";
import { groupNoticeManifest } from "./manifest";
import { bindContext, unbindContext } from "./host/bridge";
import { createLogger } from "./shared/logger";
import GroupNoticeBubble from "./components/GroupNoticeBubble.vue";
import GroupNoticeHost from "./components/GroupNoticeHost.vue";

const logger = createLogger("plugin");

export const manifest = groupNoticeManifest;

/** 消息 domain 渲染器：group_notice 消息按 level 着色渲染卡片 */
export const renderers: Record<string, Component> = {
  group_notice: GroupNoticeBubble,
};

let cleanup: (() => void) | null = null;

// 工具栏入口图标：复用宿主 TDesign 全局 Icon 组件（与宿主共享同一运行时实例）。
function makeIcon(name: string): Component {
  return defineComponent({
    name: `GroupNoticeToolbarIcon-${name}`,
    render: () => h(Icon, { name }),
  });
}
const NoticeIcon = makeIcon("notification");

export function activate(ctx: PluginContext): void {
  bindContext(ctx);

  // 挂载通知面板浮层（GroupNoticeHost），捕获实例供工具栏点击转发“打开/刷新”动作。
  const overlayHandle =
    ctx.host.mountOverlay?.(GroupNoticeHost, {}) ?? { unmount: () => {}, instance: null };
  const unmount = overlayHandle.unmount;

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

  const detach = ctx.host.registerToolbarAction?.(action) ?? (() => {});

  cleanup = () => {
    detach();
    unmount();
    unbindContext();
  };
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
