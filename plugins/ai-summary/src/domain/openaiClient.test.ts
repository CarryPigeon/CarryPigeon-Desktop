/**
 * @fileoverview OpenAI 兼容客户端纯函数单测。
 * @description 覆盖：端点 URL 拼接规则、密钥引用认证头、请求体构造、
 * chat/completions 与 /models 响应解析（含上游错误透出与容错）。
 */

import { describe, expect, it } from "vitest";
import {
  API_KEY_SECRET_NAME,
  buildAuthHeaders,
  buildChatCompletionBody,
  buildChatCompletionsUrl,
  buildModelsUrl,
  parseChatCompletionResponse,
  parseModelsResponse,
} from "./openaiClient";

describe("buildChatCompletionsUrl", () => {
  it("常规 base URL 追加 /chat/completions", () => {
    expect(buildChatCompletionsUrl("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://api.openai.com/v1")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("已以 /chat/completions 结尾则原样使用（含去尾部斜杠）", () => {
    expect(buildChatCompletionsUrl("https://gw.example.com/v1/chat/completions")).toBe(
      "https://gw.example.com/v1/chat/completions",
    );
    expect(buildChatCompletionsUrl("https://gw.example.com/chat/completions/")).toBe(
      "https://gw.example.com/chat/completions",
    );
  });

  it("本地服务（Ollama）同样适用", () => {
    expect(buildChatCompletionsUrl("http://localhost:11434/v1")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
});

describe("buildModelsUrl", () => {
  it("追加 /models 且不与 /chat/completions 冲突", () => {
    expect(buildModelsUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1/models");
    expect(buildModelsUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1/models");
    expect(buildModelsUrl("https://x.example/models")).toBe("https://x.example/models");
  });
});

describe("buildAuthHeaders", () => {
  it("使用密钥引用（由宿主 Rust 侧解析，不落明文）", () => {
    expect(buildAuthHeaders()).toEqual({ authorization: `Bearer @secret(${API_KEY_SECRET_NAME})` });
    expect(API_KEY_SECRET_NAME).toBe("api_key");
  });
});

describe("buildChatCompletionBody", () => {
  it("包含模型、消息与有限温度", () => {
    const body = buildChatCompletionBody({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      temperature: 0.3,
    });
    expect(body).toEqual({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "sys" },
        { role: "user", content: "hi" },
      ],
      temperature: 0.3,
    });
  });

  it("非法温度省略字段", () => {
    const body = buildChatCompletionBody({
      model: "m",
      messages: [],
      temperature: Number.NaN,
    });
    expect("temperature" in body).toBe(false);
  });
});

describe("parseChatCompletionResponse", () => {
  it("解析助手回复与模型名", () => {
    const parsed = parseChatCompletionResponse(
      200,
      JSON.stringify({
        choices: [{ message: { role: "assistant", content: "  总结内容  " } }],
        model: "deepseek-flash",
      }),
    );
    expect(parsed).toEqual({ ok: true, content: "总结内容", model: "deepseek-flash" });
  });

  it("空回复 → 失败并附状态码", () => {
    const parsed = parseChatCompletionResponse(
      200,
      JSON.stringify({ choices: [{ message: { role: "assistant", content: "   " } }] }),
    );
    expect(parsed).toEqual({ ok: false, error: "empty completion content" });
  });

  it("上游错误：透出 error.message 并附状态码", () => {
    const parsed = parseChatCompletionResponse(
      401,
      JSON.stringify({ error: { message: "invalid api key" } }),
    );
    expect(parsed).toEqual({ ok: false, error: "invalid api key (HTTP 401)" });
  });

  it("非 JSON 响应 → 失败并附状态码（0 状态给出通用措辞）", () => {
    expect(parseChatCompletionResponse(502, "<html>")).toEqual({ ok: false, error: "HTTP 502" });
    expect(parseChatCompletionResponse(0, "<html>")).toEqual({
      ok: false,
      error: "invalid response body",
    });
  });
});

describe("parseModelsResponse", () => {
  it("解析去空去重的模型列表", () => {
    const parsed = parseModelsResponse(
      200,
      JSON.stringify({ data: [{ id: "a" }, { id: " a " }, { id: "" }, { id: "b" }, { noId: true }] }),
    );
    expect(parsed).toEqual({ ok: true, models: ["a", "b"] });
  });

  it("空列表 / 非 JSON → 失败", () => {
    expect(parseModelsResponse(200, JSON.stringify({ data: [] }))).toEqual({
      ok: false,
      error: "no models returned",
    });
    expect(parseModelsResponse(500, "oops")).toEqual({ ok: false, error: "HTTP 500" });
  });
});
