import { describe, it, expect, vi, beforeEach } from "vitest";

// 模拟 Tauri 事件系统：维护活跃处理器集合，unlisten 负责解绑
const activeHandlers = new Set<(e: { payload: unknown }) => void>();
const listenMock = vi.fn(async (_event: string, handler: (e: { payload: unknown }) => void) => {
  activeHandlers.add(handler);
  return () => activeHandlers.delete(handler);
});

/** 模拟事件派发：仅触达当前仍处于订阅状态的处理器 */
const emitToActive = (payload: unknown) => {
  for (const h of Array.from(activeHandlers)) h({ payload });
};

vi.mock("@tauri-apps/api/event", () => ({
  listen: (...args: unknown[]) => listenMock(args[0] as string, args[1] as (e: { payload: unknown }) => void),
}));

import { createPluginEventApi } from "./pluginEventApi";
import { createPluginScope } from "./pluginScope";

describe("createPluginEventApi", () => {
  beforeEach(() => {
    // 每个用例独立计数与处理器集合，避免相互污染
    listenMock.mockClear();
    activeHandlers.clear();
  });

  it("拒绝非白名单事件", () => {
    const onEvent = createPluginEventApi("voice_call:");
    expect(() => onEvent("other:event", () => {})).toThrow(/denied/);
  });
  it("允许白名单事件并返回取消函数", () => {
    const onEvent = createPluginEventApi("voice_call:");
    const off = onEvent("voice_call:incoming", () => {});
    expect(typeof off).toBe("function");
  });

  it("scope dispose 后订阅自动失效、处理器不再被调用", async () => {
    const scope = createPluginScope("plugin-a");
    const onEvent = createPluginEventApi("voice_call:", scope, "plugin-a");
    const handler = vi.fn();
    onEvent("voice_call:incoming", handler);
    expect(listenMock).toHaveBeenCalledTimes(1);
    expect(activeHandlers.size).toBe(1);

    // 销毁作用域：订阅应被自动取消（事件派发不再触达处理器）
    await scope.dispose();
    expect(activeHandlers.size).toBe(0);
    emitToActive({ reason: "ring" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("手动取消后 scope dispose 不再重复清理", async () => {
    const scope = createPluginScope("plugin-a");
    const unlisten = vi.fn();
    listenMock.mockImplementationOnce(async () => unlisten);
    const onEvent = createPluginEventApi("voice_call:", scope, "plugin-a");
    const off = onEvent("voice_call:incoming", () => {});
    off();
    await scope.dispose();
    // 取消幂等：dispose 不应再次触发底层 unlisten
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("scope 已 disposed 后 onEvent 变为 no-op 并告警（含 pluginId）", async () => {
    const scope = createPluginScope("plugin-a");
    await scope.dispose();
    const onEvent = createPluginEventApi("voice_call:", scope, "plugin-a");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const before = listenMock.mock.calls.length;
    const handler = vi.fn();
    const off = onEvent("voice_call:incoming", handler);
    expect(typeof off).toBe("function");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.join(" ")).toContain("plugin-a");
    expect(listenMock.mock.calls.length).toBe(before); // 不再创建新订阅
    off(); // no-op 取消函数可安全调用
    expect(handler).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("不传 scope 时保持既有行为", () => {
    const onEvent = createPluginEventApi("voice_call:");
    const handler = vi.fn();
    const off = onEvent("voice_call:incoming", handler);
    emitToActive(1);
    expect(handler).toHaveBeenCalledWith(1);
    off();
  });
});
