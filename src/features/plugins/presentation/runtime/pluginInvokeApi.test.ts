import { describe, it, expect, vi } from "vitest";

// 用 vi.mock 隔离 invokeTauri，避免真实 Tauri 运行时依赖
vi.mock("@/shared/tauri", () => ({
  invokeTauri: vi.fn(async () => ({ ok: true })),
  TAURI_COMMANDS: {} as Record<string, string>,
}));

import { createPluginInvokeApi } from "./pluginInvokeApi";

describe("createPluginInvokeApi", () => {
  it("允许白名单前缀命令", async () => {
    const invoke = createPluginInvokeApi("s", "p", "voice_call:");
    await expect(invoke("voice_call:start", { a: 1 })).resolves.toBeDefined();
  });
  it("拒绝非白名单命令", async () => {
    const invoke = createPluginInvokeApi("s", "p", "voice_call:");
    await expect(invoke("chat:send", {})).rejects.toThrow(/denied/);
  });
});
