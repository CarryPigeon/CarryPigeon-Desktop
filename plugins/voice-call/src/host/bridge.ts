/**
 * @fileoverview voice-call 宿主上下文桥（Cordis v2）。
 * @description 保存 apply 时注入的 Cordis `Context`，供组件与 composable 访问 IPC 能力。
 */
import type { Context } from "@/features/plugins/sdk";

let ctx: Context | null = null;

export function bindContext(c: Context): void {
  ctx = c;
}

export function unbindContext(): void {
  ctx = null;
}

export function getContext(): Context {
  if (!ctx) throw new Error("voice-call plugin context not bound");
  return ctx;
}

/** 调宿主原生 voice_call 后端命令（`ctx.ipc` 已按 voice_call:* 前缀白名单校验）。 */
export function invokeVoiceCall(command: string, args?: Record<string, unknown>): Promise<unknown> {
  const c = getContext();
  if (!c.ipc) throw new Error("host.ipc not available");
  return c.ipc.invoke(command, args);
}

/** 订阅 voice_call:* 后端事件（随插件 fiber 自动取消订阅）。 */
export function onVoiceCallEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  const c = getContext();
  if (!c.ipc) throw new Error("host.ipc not available");
  return c.ipc.onEvent<T>(event, handler);
}
