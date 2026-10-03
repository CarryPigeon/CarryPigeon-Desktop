/**
 * @fileoverview markdown 插件入口（Cordis v2 契约）。
 * @description
 * 提供 domain "markdown"（version "1"）的 renderer 与 composer：
 * - `ctx.domains.renderer("markdown", ...)` 渲染 { text } 消息（安全 markdown，无 innerHTML）；
 * - `ctx.domains.composer("markdown", ...)` 提供编辑 + 预览，submit 事件携带宿主契约 payload。
 */

import type { Context } from "@/features/plugins/sdk";
import { markdownManifest } from "./manifest";
import MarkdownMessage from "./components/MarkdownMessage.vue";
import MarkdownComposer from "./components/MarkdownComposer.vue";
import { createLogger } from "./shared/logger";
import "./styles/markdown.css";

const logger = createLogger("plugin");

export const name = "markdown";
export const manifest = markdownManifest;
/** 需要 domain 注册能力与服务器上下文。 */
export const inject = ["domains", "server"];

export function apply(ctx: Context): void {
  ctx.domains.renderer("markdown", MarkdownMessage);
  ctx.domains.composer("markdown", MarkdownComposer);
  logger.info("markdown_plugin_activated", { pluginId: ctx.server.serverId });
}
