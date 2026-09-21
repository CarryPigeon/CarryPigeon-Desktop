/**
 * @fileoverview markdown 插件入口。
 * @description
 * 提供 domain "markdown"（version "1"）的 renderer 与 composer：
 * - renderers.markdown 渲染 { text } 消息（安全 markdown，无 innerHTML）；
 * - composers.markdown 提供编辑 + 预览，submit 事件携带宿主契约 payload。
 */

import type { Component } from "vue";
import type { PluginContext } from "@/features/plugins/api-types";
import { markdownManifest } from "./manifest";
import MarkdownMessage from "./components/MarkdownMessage.vue";
import MarkdownComposer from "./components/MarkdownComposer.vue";
import { createLogger } from "./shared/logger";
import "./styles/markdown.css";

const logger = createLogger("plugin");

export const manifest = markdownManifest;

export const renderers: Record<string, Component> = {
  markdown: MarkdownMessage,
};

export const composers: Record<string, Component> = {
  markdown: MarkdownComposer,
};

let cleanup: (() => void) | null = null;

export function activate(ctx: PluginContext): void {
  // markdown 插件无全局副作用；此处仅记录激活并挂接可选的 scope dispose。
  logger.info("markdown_plugin_activated", { pluginId: ctx.pluginId, server: ctx.serverSocket });

  const dispose = () => {
    logger.info("markdown_plugin_disposed");
    cleanup = null;
  };
  ctx.onDispose?.(dispose);
  // 兼容宿主未注入 onDispose 的场景：deactivate 时兜底清理。
  cleanup = dispose;
}

export function deactivate(): void {
  cleanup?.();
  cleanup = null;
}
