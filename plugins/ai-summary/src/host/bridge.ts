/**
 * @fileoverview ai-summary 宿主上下文桥（Cordis v2）。
 * @description 保存 apply 时注入的 Cordis `Context`，供面板组件访问宿主能力服务。
 */
import type { Context } from "@/features/plugins/sdk";

let boundCtx: Context | null = null;

/** 绑定插件运行时上下文（apply 时调用一次）。 */
export function bindContext(ctx: Context): void {
  boundCtx = ctx;
}

/** 解绑上下文（dispose 时调用）。 */
export function unbindContext(): void {
  boundCtx = null;
}

/** 读取已绑定的上下文；未绑定时抛错（调用方需自行兜底）。 */
export function getContext(): Context {
  if (!boundCtx) {
    throw new Error("ai-summary plugin context is not bound yet");
  }
  return boundCtx;
}
