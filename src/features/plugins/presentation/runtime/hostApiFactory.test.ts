/**
 * @fileoverview hostApiFactory 的 ai / messages 能力门控单测。
 * @description
 * 覆盖安全边界：
 * - 未声明 "ai" 权限时不得注入 `host.ai`；
 * - 声明后 `summarize` 才转发到 ai capability；
 * - scope 销毁后变为 no-op（回退语义由 `not-configured` 承载）；
 * - capability 抛错时兜底为 `request-failed`，不把异常抛进插件运行时；
 * - `host.messages` 只由 "messages:read" 权限 + 读取桥共同注入，scope 销毁后返回空结果。
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
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["storage", "ui"] });
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
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["ai"] });

    expect(host.ai).toBeDefined();
    await expect(host.ai!.isConfigured()).resolves.toBe(true);
    await expect(
      host.ai!.summarize({ channelId: "c1", messages: ["a", "b"] }),
    ).resolves.toMatchObject({ ok: true });
    expect(summarizeMock).toHaveBeenCalledWith("c1", ["a", "b"]);
  });

  it("summarize 入参做防御式归一（缺失/非数组不抛错）", async () => {
    summarizeMock.mockResolvedValue({ ok: false, code: "not-configured", error: "x" });
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["ai"] });

    await host.ai!.summarize({} as never);

    expect(summarizeMock).toHaveBeenCalledWith("", []);
  });

  it("capability 抛错：兜底为 request-failed，不向上抛", async () => {
    summarizeMock.mockRejectedValue(new Error("boom"));
    getStatusMock.mockRejectedValue(new Error("boom"));
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["ai"] });

    await expect(host.ai!.isConfigured()).resolves.toBe(false);
    await expect(host.ai!.summarize({ channelId: "c1", messages: ["a"] })).resolves.toMatchObject({
      ok: false,
      code: "request-failed",
    });
  });

  it("scope 销毁后：isConfigured=false，summarize 返回 not-configured（触发插件回退服务端）", async () => {
    const scope = createPluginScope("p");
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["ai"], scope });

    scope.dispose();

    await expect(host.ai!.isConfigured()).resolves.toBe(false);
    await expect(host.ai!.summarize({ channelId: "c1", messages: ["a"] })).resolves.toMatchObject({
      ok: false,
      code: "not-configured",
    });
    expect(summarizeMock).not.toHaveBeenCalled();
  });
});

describe("createHostApi / host.messages", () => {
  const snapshot = {
    channelId: "c1",
    channelName: "研发",
    totalCount: 2,
    truncated: false,
    hasMoreHistory: true,
    capturedAtMs: 1,
    messages: [{ messageId: "m1", senderId: "u1", senderName: "Alice", timeMs: 1, text: "hi" }],
    selectedMessageIds: ["m1"],
    selectedTotalCount: 2,
  };

  function createReader() {
    return {
      readCurrentChannel: vi.fn(async () => snapshot),
      loadMoreHistory: vi.fn(async () => ({ loadedCount: 2, loadedDelta: 1, hasMore: false })),
    };
  }

  it("未声明 messages:read 权限：即便传入读取桥也不注入 host.messages", () => {
    const reader = createReader();
    const host = createHostApi({
      serverSocket: "s",
      pluginId: "p",
      permissions: ["storage", "ai"],
      messagesReader: reader,
    });

    expect(host.messages).toBeUndefined();
    expect(reader.readCurrentChannel).not.toHaveBeenCalled();
  });

  it("声明权限但宿主未提供读取桥：不注入（插件应提示宿主不支持）", () => {
    const host = createHostApi({ serverSocket: "s", pluginId: "p", permissions: ["messages:read"] });

    expect(host.messages).toBeUndefined();
  });

  it("声明权限且提供读取桥：转发读取与翻页，并对入参做防御式归一", async () => {
    const reader = createReader();
    const host = createHostApi({
      serverSocket: "s",
      pluginId: "p",
      permissions: ["messages:read"],
      messagesReader: reader,
    });

    await expect(host.messages!.readCurrentChannel()).resolves.toEqual(snapshot);
    expect(reader.readCurrentChannel).toHaveBeenCalledWith(undefined);

    await expect(host.messages!.readCurrentChannel({ maxMessages: 10 })).resolves.toEqual(snapshot);
    expect(reader.readCurrentChannel).toHaveBeenLastCalledWith({ maxMessages: 10 });

    // 非数字入参不透传，退回桥的默认值。
    await host.messages!.readCurrentChannel({ maxMessages: "abc" } as never);
    expect(reader.readCurrentChannel).toHaveBeenLastCalledWith(undefined);

    await expect(host.messages!.loadMoreHistory()).resolves.toEqual({
      loadedCount: 2,
      loadedDelta: 1,
      hasMore: false,
    });
  });

  it("读取桥抛错：兜底为空快照，不向上抛", async () => {
    const reader = createReader();
    reader.readCurrentChannel.mockRejectedValue(new Error("boom"));
    reader.loadMoreHistory.mockRejectedValue(new Error("boom"));
    const host = createHostApi({
      serverSocket: "s",
      pluginId: "p",
      permissions: ["messages:read"],
      messagesReader: reader,
    });

    await expect(host.messages!.readCurrentChannel()).resolves.toEqual({
      channelId: "",
      channelName: "",
      totalCount: 0,
      truncated: false,
      hasMoreHistory: false,
      capturedAtMs: 0,
      messages: [],
      selectedMessageIds: [],
      selectedTotalCount: 0,
    });
    await expect(host.messages!.loadMoreHistory()).resolves.toEqual({
      loadedCount: 0,
      loadedDelta: 0,
      hasMore: false,
    });
  });

  it("scope 销毁后：读取与翻页变为空结果且不再调用读取桥", async () => {
    const reader = createReader();
    const scope = createPluginScope("p");
    const host = createHostApi({
      serverSocket: "s",
      pluginId: "p",
      permissions: ["messages:read"],
      messagesReader: reader,
      scope,
    });

    scope.dispose();

    await expect(host.messages!.readCurrentChannel()).resolves.toMatchObject({ channelId: "" });
    await expect(host.messages!.loadMoreHistory()).resolves.toMatchObject({ loadedDelta: 0 });
    expect(reader.readCurrentChannel).not.toHaveBeenCalled();
    expect(reader.loadMoreHistory).not.toHaveBeenCalled();
  });
});
