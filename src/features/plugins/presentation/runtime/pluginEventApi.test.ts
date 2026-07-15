import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => {}),
}));

import { createPluginEventApi } from "./pluginEventApi";

describe("createPluginEventApi", () => {
  it("拒绝非白名单事件", () => {
    const onEvent = createPluginEventApi("voice_call:");
    expect(() => onEvent("other:event", () => {})).toThrow(/denied/);
  });
  it("允许白名单事件并返回取消函数", () => {
    const onEvent = createPluginEventApi("voice_call:");
    const off = onEvent("voice_call:incoming", () => {});
    expect(typeof off).toBe("function");
  });
});
