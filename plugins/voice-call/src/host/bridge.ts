import type { PluginContext } from "@/features/plugins/domain/types/pluginRuntimeTypes";

let ctx: PluginContext | null = null;

export function bindContext(c: PluginContext): void {
  ctx = c;
}

export function getContext(): PluginContext {
  if (!ctx) throw new Error("voice-call plugin context not bound");
  return ctx;
}

/** 调宿主原生 voice_call 后端命令（host.invoke 已按 voice_call:* 白名单校验）。 */
export function invokeVoiceCall(command: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!ctx?.host.invoke) throw new Error("host.invoke not available");
  return ctx.host.invoke(command, args);
}

/** 订阅 voice_call:* 后端事件。 */
export function onVoiceCallEvent<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): () => void {
  if (!ctx?.host.onEvent) throw new Error("host.onEvent not available");
  return ctx.host.onEvent<T>(event, handler);
}
