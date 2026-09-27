/**
 * @fileoverview ai 领域纯函数单测。
 * @description
 * 覆盖：预设表完整性、配置归一化容错、目标解析（服务端回退/配置不完整）、
 * 总结提示词组装（空消息/截断/序号）。
 */

import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_SYSTEM_PROMPT,
  MAX_SUMMARIZE_MESSAGES,
  MAX_SUMMARIZE_MESSAGE_CHARS,
  buildSummarizeMessages,
  getAiProviderPreset,
  isAiProviderId,
  normalizeAiProviderConfig,
  resolveAiTarget,
} from "./types";

describe("AI_PROVIDER_PRESETS", () => {
  it("id 唯一且包含 server 与 custom 兜底项", () => {
    const ids = AI_PROVIDER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("server");
    expect(ids).toContain("custom");
  });

  it("除 server 外均给出可用的 http(s) base URL", () => {
    for (const preset of AI_PROVIDER_PRESETS) {
      if (preset.id === "server" || preset.id === "custom") continue;
      expect(preset.baseUrl).toMatch(/^https?:\/\//);
    }
  });

  it("本地 provider 不需要密钥", () => {
    for (const preset of AI_PROVIDER_PRESETS) {
      if (preset.local) expect(preset.requiresApiKey).toBe(false);
    }
  });
});

describe("isAiProviderId / getAiProviderPreset", () => {
  it("识别合法 id，拒绝非法值", () => {
    expect(isAiProviderId("deepseek")).toBe(true);
    expect(isAiProviderId("nope")).toBe(false);
    expect(isAiProviderId(123)).toBe(false);
  });

  it("未知 id 回退到第一个预设（server）", () => {
    expect(getAiProviderPreset("nope" as never).id).toBe("server");
  });
});

describe("normalizeAiProviderConfig", () => {
  it("非对象输入回退全默认", () => {
    expect(normalizeAiProviderConfig(null)).toEqual(DEFAULT_AI_CONFIG);
    expect(normalizeAiProviderConfig("x")).toEqual(DEFAULT_AI_CONFIG);
  });

  it("非法 providerId 回退默认，字符串字段去空白", () => {
    const cfg = normalizeAiProviderConfig({
      providerId: "bogus",
      baseUrl: "  https://api.example.com/v1  ",
      model: "  m1 ",
    });
    expect(cfg.providerId).toBe(DEFAULT_AI_CONFIG.providerId);
    expect(cfg.baseUrl).toBe("https://api.example.com/v1");
    expect(cfg.model).toBe("m1");
  });

  it("温度与超时被裁剪到合法区间，NaN 回退默认", () => {
    expect(normalizeAiProviderConfig({ temperature: 99, timeoutMs: 1 }).temperature).toBe(2);
    expect(normalizeAiProviderConfig({ temperature: -5, timeoutMs: 1 }).temperature).toBe(0);
    expect(normalizeAiProviderConfig({ timeoutMs: 1 }).timeoutMs).toBe(1000);
    expect(normalizeAiProviderConfig({ timeoutMs: 10 ** 9 }).timeoutMs).toBe(120000);
    expect(normalizeAiProviderConfig({ temperature: Number.NaN }).temperature).toBe(
      DEFAULT_AI_CONFIG.temperature,
    );
  });
});

describe("resolveAiTarget", () => {
  it("server 表示不使用客户端 AI（返回 null）", () => {
    expect(resolveAiTarget({ ...DEFAULT_AI_CONFIG, providerId: "server" })).toBeNull();
  });

  it("base URL 或模型名为空时不返回目标", () => {
    expect(
      resolveAiTarget({ ...DEFAULT_AI_CONFIG, providerId: "deepseek", baseUrl: "", model: "m" }),
    ).toBeNull();
    expect(
      resolveAiTarget({
        ...DEFAULT_AI_CONFIG,
        providerId: "deepseek",
        baseUrl: "https://api.deepseek.com",
        model: "   ",
      }),
    ).toBeNull();
  });

  it("配置完整时给出目标并带上预设的密钥要求", () => {
    const target = resolveAiTarget({
      ...DEFAULT_AI_CONFIG,
      providerId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
    });
    expect(target).toMatchObject({
      providerId: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-flash",
      requiresApiKey: true,
    });
  });

  it("空系统提示词回退到内置默认提示词", () => {
    const target = resolveAiTarget({
      ...DEFAULT_AI_CONFIG,
      providerId: "ollama",
      baseUrl: "http://localhost:11434/v1",
      model: "llama3.1",
      systemPrompt: "   ",
    });
    expect(target?.systemPrompt).toBe(DEFAULT_AI_SYSTEM_PROMPT);
  });
});

describe("buildSummarizeMessages", () => {
  it("空消息返回空数组（调用方据此不发请求）", () => {
    expect(buildSummarizeMessages([], "sys")).toEqual([]);
    expect(buildSummarizeMessages(["  ", ""], "sys")).toEqual([]);
  });

  it("组装 system + 带序号的 user 消息", () => {
    const messages = buildSummarizeMessages(["第一条", " 第二条 "], "sys");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: "system", content: "sys" });
    expect(messages[1]!.content).toBe("1. 第一条\n2. 第二条");
  });

  it("条数与单条长度都被截断", () => {
    const many = Array.from({ length: MAX_SUMMARIZE_MESSAGES + 20 }, (_, i) => `m${i}`);
    const messages = buildSummarizeMessages(many, "sys");
    const userContent = messages[1]!.content;
    expect(userContent.split("\n")).toHaveLength(MAX_SUMMARIZE_MESSAGES);
    expect(userContent).toContain(`1. m0`);
    expect(userContent).not.toContain(`m${MAX_SUMMARIZE_MESSAGES} `);

    const long = buildSummarizeMessages(["x".repeat(MAX_SUMMARIZE_MESSAGE_CHARS + 50)], "sys");
    expect(long[1]!.content).toBe(`1. ${"x".repeat(MAX_SUMMARIZE_MESSAGE_CHARS)}`);
  });

  it("非数组输入容错为空数组", () => {
    expect(buildSummarizeMessages(undefined as never, "sys")).toEqual([]);
  });
});
