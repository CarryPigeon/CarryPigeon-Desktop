/**
 * @fileoverview hostApiFactory 的 ai 能力门控单测。
 * @description
 * 覆盖安全边界：
 * - 未声明 "ai" 权限时不得注入 `host.ai`；
 * - 声明后 `summarize` 才转发到 ai capability；
 * - scope 销毁后变为 no-op（回退语义由 `not-configured` 承载）；
 * - capability 抛错时兜底为 `request-failed`，不把异常抛进插件运行时。
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

const summarizeMock = vi.fn();
const getStatusMock = vi.fn();

vi.mock("@/features/ai/api", () => ({
  getAiCapabilities: () => ({
    summarize: (...args: unknown[]) => summarizeMock(...args),
    getStatus: () => getStatusMock(),
  }),
}));

import { createHostApi } from "./hostApiFactory";
import { createPluginScope } from "./pluginScope";

describe("createHostApi / host.ai", () => {
  beforeEach(() => {
    summarizeMock.mockReset();
    getStatusMock.mockReset();
    getStatusMock.mockResolvedValue({ ready: true });
  });

  it("未声明 ai 权限：不注入 host.ai", () => {
    const host = createHostApi("s", "p", ["storage", "ui"]);
    expect(host.ai).toBeUndefined();
  });

  it("声明 ai 权限：注入 host.ai 并转发到 ai capability", async () => {
    summarizeMock.mockResolvedValue({
      ok: true,
      summary: "s",
      messageCount: 1,
      provider: "DeepSeek",
      model: "deepseek-flash",
    });
    const host = createHostApi("s", "p", ["ai"]);

    expect(host.ai).toBeDefined();
    await expect(host.ai!.isConfigured()).resolves.toBe(true);
    await expect(
      host.ai!.summarize({ channelId: "c1", messages: ["a", "b"] }),
    ).resolves.toMatchObject({ ok: true });
    expect(summarizeMock).toHaveBeenCalledWith("c1", ["a", "b"]);
  });

  it("summarize 入参做防御式归一（缺失/非数组不抛错）", async () => {
    summarizeMock.mockResolvedValue({ ok: false, code: "not-configured", error: "x" });
    const host = createHostApi("s", "p", ["ai"]);

    await host.ai!.summarize({} as never);

    expect(summarizeMock).toHaveBeenCalledWith("", []);
  });

  it("capability 抛错：兜底为 request-failed，不向上抛", async () => {
    summarizeMock.mockRejectedValue(new Error("boom"));
    getStatusMock.mockRejectedValue(new Error("boom"));
    const host = createHostApi("s", "p", ["ai"]);

    await expect(host.ai!.isConfigured()).resolves.toBe(false);
    await expect(host.ai!.summarize({ channelId: "c1", messages: ["a"] })).resolves.toMatchObject({
      ok: false,
      code: "request-failed",
    });
  });

  it("scope 销毁后：isConfigured=false，summarize 返回 not-configured（触发插件回退服务端）", async () => {
    const scope = createPluginScope("p");
    const host = createHostApi("s", "p", ["ai"], undefined, undefined, scope);

    scope.dispose();

    await expect(host.ai!.isConfigured()).resolves.toBe(false);
    await expect(host.ai!.summarize({ channelId: "c1", messages: ["a"] })).resolves.toMatchObject({
      ok: false,
      code: "not-configured",
    });
    expect(summarizeMock).not.toHaveBeenCalled();
  });
});
