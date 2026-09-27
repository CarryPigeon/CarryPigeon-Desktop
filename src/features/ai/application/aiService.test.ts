/**
 * @fileoverview ai application service 单测。
 * @description
 * 覆盖：配置持久化、客户端 AI 的五条分支（未配置/配置不完整/缺密钥/请求失败/成功）、
 * 密钥状态失败时的降级，以及"已显式选择 provider 时不静默回退服务端"的判定语义。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const chatCompletionMock = vi.fn();
const getAiSecretStatusMock = vi.fn();
const setAiSecretMock = vi.fn();
const clearAiSecretMock = vi.fn();
const listAiModelsMock = vi.fn();

vi.mock("../data/tauriAiTransport", () => ({
  chatCompletion: (...args: unknown[]) => chatCompletionMock(...args),
  getAiSecretStatus: (...args: unknown[]) => getAiSecretStatusMock(...args),
  setAiSecret: (...args: unknown[]) => setAiSecretMock(...args),
  clearAiSecret: (...args: unknown[]) => clearAiSecretMock(...args),
  listAiModels: (...args: unknown[]) => listAiModelsMock(...args),
}));

import {
  fetchAiModels,
  getAiProviderConfig,
  getClientAiStatus,
  saveProviderSecret,
  summarizeWithClientAi,
  updateAiProviderConfig,
} from "./aiService";
import { DEFAULT_AI_CONFIG, type AiProviderConfig } from "../domain/types";
import { KEY_AI_PROVIDER_CONFIG } from "@/shared/utils/storageKeys";

/** 写入一份"客户端 DeepSeek"配置。 */
function setClientConfig(patch: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return updateAiProviderConfig({
    ...DEFAULT_AI_CONFIG,
    providerId: "deepseek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    ...patch,
  });
}

describe("aiService", () => {
  beforeEach(() => {
    localStorage.clear();
    chatCompletionMock.mockReset();
    getAiSecretStatusMock.mockReset();
    setAiSecretMock.mockReset();
    clearAiSecretMock.mockReset();
    listAiModelsMock.mockReset();
    getAiSecretStatusMock.mockResolvedValue({ configured: true, secureStorageAvailable: true });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("未配置时读取默认配置（跟随服务端）", () => {
    expect(getAiProviderConfig()).toEqual(DEFAULT_AI_CONFIG);
  });

  it("保存配置会归一化并落 localStorage", () => {
    setClientConfig({ baseUrl: "  https://api.deepseek.com  ", timeoutMs: 10 });
    expect(localStorage.getItem(KEY_AI_PROVIDER_CONFIG)).toContain("deepseek");
    const loaded = getAiProviderConfig();
    expect(loaded.baseUrl).toBe("https://api.deepseek.com");
    expect(loaded.timeoutMs).toBe(1000);
  });

  it("providerId=server：返回 not-configured（调用方回退服务端）", async () => {
    updateAiProviderConfig({ ...DEFAULT_AI_CONFIG, providerId: "server" });

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "not-configured" });
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it("已选 provider 但 base URL 缺失：incomplete-config 且带 provider 名", async () => {
    setClientConfig({ baseUrl: "" });

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "incomplete-config", provider: "DeepSeek" });
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it("需要密钥但未配置：api-key-missing，且不发请求", async () => {
    setClientConfig();
    getAiSecretStatusMock.mockResolvedValue({ configured: false, secureStorageAvailable: true });

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "api-key-missing", provider: "DeepSeek" });
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it("密钥查询失败（非 Tauri 环境）同样按缺密钥处理，不抛错", async () => {
    setClientConfig();
    getAiSecretStatusMock.mockRejectedValue(new Error("Tauri runtime unavailable"));

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "api-key-missing" });
  });

  it("上游失败：request-failed 且带状态码与 provider 名", async () => {
    setClientConfig();
    chatCompletionMock.mockResolvedValue({
      ok: false,
      status: 401,
      content: "",
      error: "invalid api key",
    });

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({
      ok: false,
      code: "request-failed",
      status: 401,
      error: "invalid api key",
      provider: "DeepSeek",
    });
  });

  it("成功：返回总结正文、来源与模型（模型名以上游回传为准）", async () => {
    setClientConfig();
    chatCompletionMock.mockResolvedValue({
      ok: true,
      status: 200,
      content: "  这是总结  ",
      model: "deepseek-flash-0715",
    });

    const res = await summarizeWithClientAi("c1", ["第一条", "第二条"]);

    expect(res).toEqual({
      ok: true,
      summary: "这是总结",
      messageCount: 2,
      provider: "DeepSeek",
      providerId: "deepseek",
      model: "deepseek-flash-0715",
    });
    // 请求确由宿主发起，且带上 provider 与消息
    const call = chatCompletionMock.mock.calls[0]![0] as { providerId: string; messages: unknown[] };
    expect(call.providerId).toBe("deepseek");
    expect(call.messages).toHaveLength(2);
  });

  it("空内容视为失败（避免把空串当总结展示）", async () => {
    setClientConfig();
    chatCompletionMock.mockResolvedValue({ ok: true, status: 200, content: "   " });

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "request-failed" });
  });

  it("invoke 抛错时归一化为 request-failed", async () => {
    setClientConfig();
    chatCompletionMock.mockRejectedValue(new Error("ipc down"));

    const res = await summarizeWithClientAi("c1", ["a"]);

    expect(res).toMatchObject({ ok: false, code: "request-failed" });
  });

  it("空消息不发起请求", async () => {
    setClientConfig();

    const res = await summarizeWithClientAi("c1", ["  "]);

    expect(res).toMatchObject({ ok: false, code: "incomplete-config" });
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it("getClientAiStatus：跟随服务端时 active/ready 均为 false", async () => {
    updateAiProviderConfig({ ...DEFAULT_AI_CONFIG, providerId: "server" });

    const status = await getClientAiStatus();

    expect(status).toMatchObject({ active: false, ready: false, providerId: "server" });
  });

  it("getClientAiStatus：本地 provider 无需密钥即就绪；需要密钥的未配置则不就绪", async () => {
    updateAiProviderConfig({
      ...DEFAULT_AI_CONFIG,
      providerId: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.1",
    });
    getAiSecretStatusMock.mockResolvedValue({ configured: false, secureStorageAvailable: true });
    expect(await getClientAiStatus()).toMatchObject({ active: true, ready: true });

    setClientConfig();
    expect(await getClientAiStatus()).toMatchObject({ active: true, ready: false });
  });

  it("保存密钥走单向写入，返回值不包含明文回读", async () => {
    setAiSecretMock.mockResolvedValue(undefined);
    await saveProviderSecret("deepseek", "sk-secret");
    expect(setAiSecretMock).toHaveBeenCalledWith("deepseek", "sk-secret");
  });

  it("base URL 为空时不发起模型拉取", async () => {
    setClientConfig({ baseUrl: "" });

    const res = await fetchAiModels(getAiProviderConfig());

    expect(res).toMatchObject({ ok: false, models: [] });
    expect(listAiModelsMock).not.toHaveBeenCalled();
  });

  it("模型拉取透传超时与密钥要求", async () => {
    const cfg = setClientConfig({ timeoutMs: 5000 });
    listAiModelsMock.mockResolvedValue({ ok: true, status: 200, models: ["m1"] });

    const res = await fetchAiModels(cfg);

    expect(res.models).toEqual(["m1"]);
    expect(listAiModelsMock).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "deepseek", timeoutMs: 5000, requiresApiKey: true }),
    );
  });
});
