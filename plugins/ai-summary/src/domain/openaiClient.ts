/**
 * @fileoverview AI 总结插件的 OpenAI 兼容客户端纯逻辑（不依赖 Vue / Tauri / 浏览器 API）。
 * @description
 * URL 拼接、请求体构造与响应解析的纯函数；实际网络请求由宿主 `ctx.network.fetch`
 * 受控发出（外源访问需 manifest 声明 `network:external` 权限）。
 *
 * 安全说明：认证头使用 `Bearer @secret(api_key)` 引用，密钥明文由宿主 Rust 侧从
 * 系统凭据管理器解析替换，不进入 WebView、不落插件存储与日志。
 */

import type { AiChatMessage } from "./aiProvider";

/** 插件存放 API Key 的密钥名（`ctx.secrets` 命名空间内）。 */
export const API_KEY_SECRET_NAME = "api_key";

/**
 * 拼接 chat/completions 端点 URL。
 *
 * 规则：base URL 已以 `/chat/completions` 结尾则原样使用（用户可能直接粘贴完整端点），
 * 否则去掉尾部斜杠后追加。
 *
 * @param baseUrl - OpenAI 兼容 base URL。
 * @returns 完整端点 URL。
 */
export function buildChatCompletionsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/chat/completions")) return base;
  return `${base}/chat/completions`;
}

/**
 * 拼接模型列表端点 URL（`GET {baseUrl}/models`）。
 *
 * @param baseUrl - OpenAI 兼容 base URL。
 * @returns 完整端点 URL。
 */
export function buildModelsUrl(baseUrl: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  if (base.endsWith("/models")) return base;
  return `${base}/models`;
}

/**
 * 构造认证请求头（密钥引用形式，由宿主解析）。
 *
 * @returns 含 `authorization` 的头表；无需密钥时为空对象（不发送 Authorization）。
 */
export function buildAuthHeaders(): Record<string, string> {
  return { authorization: `Bearer @secret(${API_KEY_SECRET_NAME})` };
}

/** chat/completions 请求体。 */
export type ChatCompletionRequestBody = {
  model: string;
  messages: AiChatMessage[];
  temperature?: number;
};

/**
 * 构造 chat/completions 请求载荷。
 *
 * @param input - 模型名、消息与采样温度。
 * @returns 请求体对象（调用方序列化为 JSON）。
 */
export function buildChatCompletionBody(input: {
  model: string;
  messages: readonly AiChatMessage[];
  temperature?: number;
}): ChatCompletionRequestBody {
  const body: ChatCompletionRequestBody = {
    model: input.model,
    messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (typeof input.temperature === "number" && Number.isFinite(input.temperature)) {
    body.temperature = input.temperature;
  }
  return body;
}

/** 2xx 状态码：解析失败时用具体原因描述；非 2xx 用 `HTTP {status}` 概括。 */
function failureSuffix(status: number, reason: string): string {
  return typeof status === "number" && status > 0 && (status < 200 || status >= 300)
    ? `HTTP ${status}`
    : reason;
}

/** chat/completions 响应解析结果。 */
export type ChatCompletionParseResult =
  | { ok: true; content: string; model: string }
  | { ok: false; error: string };

/**
 * 解析 chat/completions 响应体。
 *
 * @param status - HTTP 状态码（用于区分错误措辞）。
 * @param bodyText - 响应正文。
 * @returns 成功时给出助手回复与模型名；失败时给出已脱敏的错误描述。
 */
export function parseChatCompletionResponse(status: number, bodyText: string): ChatCompletionParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, error: failureSuffix(status, "invalid response body") };
  }
  const record = (parsed ?? {}) as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = (choices[0] ?? {}) as Record<string, unknown>;
  const message = (first.message ?? {}) as Record<string, unknown>;
  const content = typeof message.content === "string" ? message.content.trim() : "";
  if (content) {
    const model = typeof record.model === "string" ? record.model.trim() : "";
    return { ok: true, content, model };
  }
  // 失败时优先透出上游 error.message（如 "invalid api key"），便于用户定位。
  const errorRecord = (record.error ?? null) as Record<string, unknown> | null;
  const upstream =
    errorRecord && typeof errorRecord.message === "string" && errorRecord.message.trim()
      ? errorRecord.message.trim()
      : "";
  const suffix = failureSuffix(status, "empty completion content");
  return { ok: false, error: upstream ? `${upstream} (${suffix})` : suffix };
}

/** /models 响应解析结果。 */
export type ModelsParseResult =
  | { ok: true; models: string[] }
  | { ok: false; error: string };

/**
 * 解析 /models 响应体。
 *
 * @param status - HTTP 状态码。
 * @param bodyText - 响应正文。
 * @returns 成功时给出模型名列表（去空去重，保持上游顺序）。
 */
export function parseModelsResponse(status: number, bodyText: string): ModelsParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, error: failureSuffix(status, "invalid response body") };
  }
  const record = (parsed ?? {}) as Record<string, unknown>;
  const data = Array.isArray(record.data) ? record.data : [];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const item of data) {
    const id = typeof (item as Record<string, unknown>)?.id === "string"
      ? ((item as Record<string, unknown>).id as string).trim()
      : "";
    if (id && !seen.has(id)) {
      seen.add(id);
      models.push(id);
    }
  }
  if (models.length === 0) {
    return { ok: false, error: failureSuffix(status, "no models returned") };
  }
  return { ok: true, models };
}
