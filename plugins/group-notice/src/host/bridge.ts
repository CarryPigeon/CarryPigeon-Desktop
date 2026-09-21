/**
 * @fileoverview 宿主上下文桥：保存 activate 时注入的 PluginContext，供面板组件访问 host 能力。
 */
import type { PluginContext } from "@/features/plugins/api-types";

let boundCtx: PluginContext | null = null;

/**
 * 绑定插件运行时上下文（activate 时调用一次）。
 */
export function bindContext(ctx: PluginContext): void {
  boundCtx = ctx;
}

/**
 * 解绑上下文（deactivate 时调用）。
 */
export function unbindContext(): void {
  boundCtx = null;
}

/**
 * 读取已绑定的上下文；未绑定时抛错（调用方需自行兜底）。
 */
export function getContext(): PluginContext {
  if (!boundCtx) {
    throw new Error("group-notice plugin context is not bound yet");
  }
  return boundCtx;
}
