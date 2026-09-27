/**
 * @fileoverview ai 领域类型与纯函数。
 * @description
 * 定义"客户端可替换 AI 服务"的配置形状、内置 provider 预设，以及与 UI/Tauri 无关的
 * 纯函数（配置归一化、目标解析、总结提示词组装）。
 *
 * 说明：
 * - 该文件不依赖 Vue / Tauri / 浏览器 API，可独立单测；
 * - 所有 provider 走 OpenAI 兼容协议（`POST {baseUrl}/chat/completions`），
 *   因此新增厂商通常只需增加一条预设。
 */

/**
 * 内置 provider 预设 id。
 *
 * - `server`：不自带模型，回退到聊天服务器的 `/api/ai/summarize`（客户端不接触密钥）；
 * - 其余为 OpenAI 兼容的第三方/本地服务。
 */
export type AiProviderId =
  | "server"
  | "openai"
  | "deepseek"
  | "dashscope"
  | "moonshot"
  | "ollama"
  | "custom";

/**
 * provider 预设（OpenAI 兼容协议）。
 */
export type AiProviderPreset = {
  /** 预设 id。 */
  id: AiProviderId;
  /** 展示名。 */
  label: string;
  /**
   * 预设 base URL（OpenAI SDK 语义）。
   *
   * 后端拼接规则：若该值已以 `/chat/completions` 结尾则原样使用，
   * 否则追加 `/chat/completions`。
   */
  baseUrl: string;
  /** 建议模型名；空字符串表示需用户拉取模型列表后选择。 */
  model: string;
  /** 调用是否需要 API Key。 */
  requiresApiKey: boolean;
  /** 是否为本地（loopback）服务：本地服务同样不需要密钥。 */
  local: boolean;
  /** 预设备注（中文，展示在设置页）。 */
  hint: string;
};

/**
 * 内置 provider 预设表。
 *
 * 注：base URL 依据各厂商现行文档整理；模型名仅为建议值，可在设置页任意修改
 * （提供"拉取模型列表"以避免写死模型名过期）。
 */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
  {
    id: "server",
    label: "跟随服务端（默认）",
    baseUrl: "",
    model: "",
    requiresApiKey: false,
    local: false,
    hint: "由聊天服务端的 /api/ai/summarize 完成总结，客户端不接触模型与密钥。",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    requiresApiKey: true,
    local: false,
    hint: "官方 OpenAI 接口；模型名可按账号可用范围调整。",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-flash",
    requiresApiKey: true,
    local: false,
    hint: "DeepSeek 官方 base_url 为 https://api.deepseek.com（openai 兼容）。",
  },
  {
    id: "dashscope",
    label: "通义千问（阿里云百炼）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    requiresApiKey: true,
    local: false,
    hint: "百炼 OpenAI 兼容模式；新版推荐使用带业务空间 ID 的地域域名。",
  },
  {
    id: "moonshot",
    label: "Kimi（Moonshot）",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "",
    requiresApiKey: true,
    local: false,
    hint: "模型名请点击「拉取模型列表」获取，或按控制台填写。",
  },
  {
    id: "ollama",
    label: "本地 Ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.1",
    requiresApiKey: false,
    local: true,
    hint: "本地推理，无需 API Key；需先 ollama serve 并已拉取对应模型。",
  },
  {
    id: "custom",
    label: "自定义（OpenAI 兼容）",
    baseUrl: "",
    model: "",
    requiresApiKey: true,
    local: false,
    hint: "填写任意 OpenAI 兼容网关的 base URL（如自建代理、vLLM、One-API）。",
  },
];

/**
 * 客户端 AI provider 配置（非敏感部分；API Key 由 Rust 侧保存在系统凭据管理器）。
 */
export type AiProviderConfig = {
  /** 选中的 provider。 */
  providerId: AiProviderId;
  /** base URL（OpenAI 兼容）。 */
  baseUrl: string;
  /** 模型名。 */
  model: string;
  /** 自定义系统提示词；空字符串表示使用内置默认值。 */
  systemPrompt: string;
  /** 采样温度。 */
  temperature: number;
  /** 请求超时（毫秒）。 */
  timeoutMs: number;
};

/**
 * 默认系统提示词：约束为"只依据给定消息总结"，降低编造风险。
 */
export const DEFAULT_AI_SYSTEM_PROMPT =
  "你是一个聊天记录总结助手。请用简洁的要点总结下面的聊天内容，保留关键结论与待办事项，不要编造未出现的信息。";

/**
 * 默认配置：`server` 表示沿用既有服务端行为，升级后行为不变。
 */
export const DEFAULT_AI_CONFIG: AiProviderConfig = {
  providerId: "server",
  baseUrl: "",
  model: "",
  systemPrompt: "",
  temperature: 0.3,
  timeoutMs: 30000,
};

/**
 * 单次总结允许的最大消息条数（超出截断，避免超出模型上下文与费用失控）。
 */
export const MAX_SUMMARIZE_MESSAGES = 500;

/**
 * 单条消息允许的最大字符数（超出截断）。
 */
export const MAX_SUMMARIZE_MESSAGE_CHARS = 4000;

/**
 * OpenAI 兼容 chat message。
 */
export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/**
 * 解析后的可调用目标。
 */
export type AiTarget = {
  providerId: AiProviderId;
  baseUrl: string;
  model: string;
  requiresApiKey: boolean;
  label: string;
  systemPrompt: string;
  temperature: number;
  timeoutMs: number;
};

/**
 * 判断未知值是否为合法的 provider id。
 *
 * @param raw - 待判断的值。
 * @returns 是否为内置 provider id。
 */
export function isAiProviderId(raw: unknown): raw is AiProviderId {
  return typeof raw === "string" && AI_PROVIDER_PRESETS.some((p) => p.id === raw);
}

/**
 * 按 id 读取预设；未知 id 回退到 `server` 预设。
 *
 * @param id - provider id。
 * @returns 对应预设。
 */
export function getAiProviderPreset(id: AiProviderId): AiProviderPreset {
  return AI_PROVIDER_PRESETS.find((p) => p.id === id) ?? AI_PROVIDER_PRESETS[0]!;
}

/**
 * 数值裁剪（含 NaN / Infinity 兜底）。
 *
 * @param raw - 原始值。
 * @param min - 下界。
 * @param max - 上界。
 * @param fallback - 非法值时的回退值。
 * @returns 裁剪后的有限数值。
 */
function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * 归一化字符串字段（去首尾空白，非字符串回退）。
 *
 * @param raw - 原始值。
 * @param fallback - 回退值。
 * @returns 归一化后的字符串。
 */
function normalizeString(raw: unknown, fallback: string): string {
  return typeof raw === "string" ? raw.trim() : fallback;
}

/**
 * 归一化来自持久化/导入的配置对象（容错，永不抛错）。
 *
 * @param raw - 未知来源的配置。
 * @returns 合法配置；字段非法时逐项回退默认值。
 */
export function normalizeAiProviderConfig(raw: unknown): AiProviderConfig {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_AI_CONFIG };
  const r = raw as Record<string, unknown>;
  const providerId = isAiProviderId(r.providerId) ? r.providerId : DEFAULT_AI_CONFIG.providerId;
  return {
    providerId,
    baseUrl: normalizeString(r.baseUrl, ""),
    model: normalizeString(r.model, ""),
    systemPrompt: typeof r.systemPrompt === "string" ? r.systemPrompt : "",
    temperature: clampNumber(r.temperature, 0, 2, DEFAULT_AI_CONFIG.temperature),
    timeoutMs: clampNumber(r.timeoutMs, 1000, 120000, DEFAULT_AI_CONFIG.timeoutMs),
  };
}

/**
 * 解析当前配置对应的可调用目标。
 *
 * 规则：
 * - `providerId === "server"` → 返回 `null`，表示"不使用客户端 AI，回退服务端"；
 * - base URL 或模型名为空 → 返回 `null`（配置不完整，调用方应回退/提示）。
 *
 * @param config - 归一化后的配置。
 * @returns 可调用目标；不可用时为 `null`。
 */
export function resolveAiTarget(config: AiProviderConfig): AiTarget | null {
  if (config.providerId === "server") return null;
  const baseUrl = config.baseUrl.trim();
  const model = config.model.trim();
  if (!baseUrl || !model) return null;
  const preset = getAiProviderPreset(config.providerId);
  return {
    providerId: config.providerId,
    baseUrl,
    model,
    requiresApiKey: preset.requiresApiKey,
    label: preset.label,
    systemPrompt: config.systemPrompt.trim() || DEFAULT_AI_SYSTEM_PROMPT,
    temperature: config.temperature,
    timeoutMs: config.timeoutMs,
  };
}

/**
 * 组装总结用的 chat messages（纯函数）。
 *
 * 规则：
 * - 按行/条目清空空白后丢弃空项；
 * - 条数截断到 {@link MAX_SUMMARIZE_MESSAGES}，单条截断到 {@link MAX_SUMMARIZE_MESSAGE_CHARS}；
 * - 每条前置序号，减少模型把相邻消息粘连成一句的概率。
 *
 * @param messages - 待总结消息。
 * @param systemPrompt - 系统提示词。
 * @returns OpenAI 兼容 messages 数组。
 */
export function buildSummarizeMessages(messages: readonly string[], systemPrompt: string): AiChatMessage[] {
  const cleaned = (Array.isArray(messages) ? messages : [])
    .map((m) => String(m ?? "").trim())
    .filter((m) => m.length > 0)
    .slice(0, MAX_SUMMARIZE_MESSAGES)
    .map((m) => (m.length > MAX_SUMMARIZE_MESSAGE_CHARS ? m.slice(0, MAX_SUMMARIZE_MESSAGE_CHARS) : m));
  if (cleaned.length === 0) return [];
  const body = cleaned.map((m, i) => `${i + 1}. ${m}`).join("\n");
  return [
    { role: "system", content: systemPrompt.trim() || DEFAULT_AI_SYSTEM_PROMPT },
    { role: "user", content: body },
  ];
}
