/**
 * @fileoverview ai-summary 自管 provider 领域纯函数单测。
 * @description 覆盖：预设表（无「跟随服务端」档）、配置归一化、目标解析
 * （含 providerChosen 语义）、总结消息组装（清洗/截断/编号）。
 */

import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_PROVIDER_CONFIG,
  DEFAULT_AI_SYSTEM_PROMPT,
  MAX_SUMMARIZE_MESSAGE_CHARS,
  MAX_SUMMARIZE_MESSAGES,
  buildSummarizeMessages,
  getAiProviderPreset,
  isAiProviderId,
  normalizeAiProviderConfig,
  resolveAiTarget,
} from "./aiProvider";

describe("AI_PROVIDER_PRESETS", () => {
  it("不含「跟随服务端」档（回退语义由后端偏好承担）", () => {
    expect(AI_PROVIDER_PRESETS.some((preset) => preset.id === ("server" as never))).toBe(false);
  });

  it("预设 id 唯一且 baseUrl/model 字段形状合法", () => {
    const ids = new Set(AI_PROVIDER_PRESETS.map((preset) => preset.id));
    expect(ids.size).toBe(AI_PROVIDER_PRESETS.length);
    for (const preset of AI_PROVIDER_PRESETS) {
      expect(typeof preset.label).toBe("string");
      expect(preset.label.length).toBeGreaterThan(0);
      expect(typeof preset.requiresApiKey).toBe("boolean");
      expect(typeof preset.local).toBe("boolean");
      expect(typeof preset.hint).toBe("string");
    }
  });
});

describe("isAiProviderId / getAiProviderPreset", () => {
  it("识别内置 id，拒绝未知值", () => {
    expect(isAiProviderId("openai")).toBe(true);
    expect(isAiProviderId("custom")).toBe(true);
    expect(isAiProviderId("server")).toBe(false);
    expect(isAiProviderId(42)).toBe(false);
  });

  it("未知 id 回退到首个预设（openai）", () => {
    expect(getAiProviderPreset("openai").id).toBe("openai");
    expect(getAiProviderPreset("nope" as never).id).toBe("openai");
  });
});

describe("normalizeAiProviderConfig", () => {
  it("非对象输入回退默认配置（未选择、未填写）", () => {
    expect(normalizeAiProviderConfig(null)).toEqual(DEFAULT_AI_PROVIDER_CONFIG);
    expect(normalizeAiProviderConfig("oops")).toEqual(DEFAULT_AI_PROVIDER_CONFIG);
  });

  it("字段逐项归一化：trim 字符串、裁剪数值、providerId 容错小写", () => {
    const normalized = normalizeAiProviderConfig({
      providerId: " DeepSeek ",
      baseUrl: "  https://api.deepseek.com  ",
      model: " deepseek-flash ",
      systemPrompt: "自定义提示",
      temperature: 9,
      timeoutMs: 10,
      providerChosen: true,
    });
    expect(normalized).toEqual({
      providerId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      systemPrompt: "自定义提示",
      temperature: 2,
      timeoutMs: 1000,
      providerChosen: true,
    });
  });

  it("非法温度/超时回退默认值；providerChosen 仅接受 true", () => {
    const normalized = normalizeAiProviderConfig({
      providerId: "openai",
      temperature: "not-a-number",
      timeoutMs: Number.NaN,
      providerChosen: "yes",
    });
    expect(normalized.temperature).toBe(DEFAULT_AI_PROVIDER_CONFIG.temperature);
    expect(normalized.timeoutMs).toBe(DEFAULT_AI_PROVIDER_CONFIG.timeoutMs);
    expect(normalized.providerChosen).toBe(false);
  });
});

describe("resolveAiTarget", () => {
  it("base URL 或模型名为空 → null（配合 providerChosen 区分未配置/不完整）", () => {
    expect(resolveAiTarget({ ...DEFAULT_AI_PROVIDER_CONFIG, providerChosen: true })).toBeNull();
    expect(
      resolveAiTarget({ ...DEFAULT_AI_PROVIDER_CONFIG, baseUrl: "https://x", providerChosen: true }),
    ).toBeNull();
  });

  it("配置完整 → 目标带预设属性与默认提示词兜底", () => {
    const target = resolveAiTarget({
      providerId: "ollama",
      baseUrl: "http://localhost:11434/v1/",
      model: "llama3.1",
      systemPrompt: "  ",
      temperature: 0.5,
      timeoutMs: 60000,
      providerChosen: true,
    });
    expect(target).toMatchObject({
      providerId: "ollama",
      baseUrl: "http://localhost:11434/v1/",
      model: "llama3.1",
      requiresApiKey: false,
      label: "本地 Ollama",
      systemPrompt: DEFAULT_AI_SYSTEM_PROMPT,
      temperature: 0.5,
      timeoutMs: 60000,
    });
  });
});

describe("buildSummarizeMessages", () => {
  it("空消息集返回空数组", () => {
    expect(buildSummarizeMessages([], "sys")).toEqual([]);
    expect(buildSummarizeMessages(["  ", ""], "sys")).toEqual([]);
  });

  it("每条前置序号，空提示词回退默认值", () => {
    const messages = buildSummarizeMessages(["第一条", " 第二条 "], "");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "system", content: DEFAULT_AI_SYSTEM_PROMPT });
    expect(messages[1]!.content).toBe("1. 第一条\n2. 第二条");
  });

  it("条数与单条长度截断到上限", () => {
    const many = Array.from({ length: MAX_SUMMARIZE_MESSAGES + 50 }, (_, i) => `m${i}`);
    const messages = buildSummarizeMessages(many, "sys");
    const body = messages[1]!.content;
    expect(body.split("\n")).toHaveLength(MAX_SUMMARIZE_MESSAGES);
    expect(body.split("\n")[0]).toBe("1. m0");

    const long = buildSummarizeMessages(["x".repeat(MAX_SUMMARIZE_MESSAGE_CHARS + 50)], "sys");
    expect(long[1]!.content.endsWith("x")).toBe(true);
    expect(long[1]!.content.length).toBeLessThanOrEqual(MAX_SUMMARIZE_MESSAGE_CHARS + 3);
  });

  it("非数组输入容错为空集", () => {
    expect(buildSummarizeMessages(undefined as never, "sys")).toEqual([]);
  });
});
