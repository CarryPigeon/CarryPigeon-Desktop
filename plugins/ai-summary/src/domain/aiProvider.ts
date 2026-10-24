/**
 * @fileoverview AI 总结插件自管的 provider 配置（纯逻辑，不依赖 Vue / Tauri / 浏览器 API）。
 * @description
 * 从宿主「AI 服务」设置迁移而来：provider 预设、配置归一化、目标解析与总结提示词组装
 * 全部由插件自管（配置经 `ctx.storage` 按 server 持久化；API Key 经 `ctx.secrets`
 * 存系统凭据管理器，本模块不接触密钥明文）。
 *
 * 说明：
 * - 所有 provider 走 OpenAI 兼容协议（`POST {baseUrl}/chat/completions`），
 *   新增厂商通常只需增加一条预设；
 * - 没有「跟随服务端」档：是否回退服务端由「AI 摘要后端」偏好（summarizeBackend.ts）决定，
 *   未配置 provider（目标解析为 null 且从未显式选择）等价于旧的默认行为。
 */

/** 插件自管的 provider 预设 id。 */
export type AiProviderId =
  | "openai"
  | "deepseek"
  | "dashscope"
  | "moonshot"
  | "ollama"
  | "custom";

/** provider 预设（OpenAI 兼容协议）。 */
export type AiProviderPreset = {
  /** 预设 id。 */
  id: AiProviderId;
  /** 展示名。 */
  label: string;
  /**
   * 预设 base URL（OpenAI SDK 语义）。
   *
   * 拼接规则：若该值已以 `/chat/completions` 结尾则原样使用，
   * 否则追加 `/chat/completions`（见 openaiClient.ts）。
   */
  baseUrl: string;
  /** 建议模型名；空字符串表示需用户拉取模型列表后选择。 */
  model: string;
  /** 调用是否需要 API Key。 */
  requiresApiKey: boolean;
  /** 是否为本地（loopback）服务：本地服务同样不需要密钥。 */
  local: boolean;
  /** 预设备注（中文，展示在设置项）。 */
  hint: string;
};

/**
 * 内置 provider 预设表。
 *
 * 注：base URL 依据各厂商现行文档整理；模型名仅为建议值，可在设置项任意修改
 * （提供"拉取模型列表"以避免写死模型名过期）。
 */
export const AI_PROVIDER_PRESETS: readonly AiProviderPreset[] = [
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
 * 插件自管的 provider 配置（非敏感部分；API Key 由 `ctx.secrets` 写入系统凭据管理器）。
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
  /**
   * 用户是否显式选择过 provider（区分「从未配置」与「选了但没填全」）。
   *
   * - false：视为未配置（后端 auto 时允许回退服务端，等价旧默认行为）；
   * - true 但 base URL / 模型名为空：配置不完整，给出可操作提示且不静默回退。
   */
  providerChosen: boolean;
};

/**
 * 默认系统提示词：约束为"只依据给定消息总结"，降低编造风险。
 */
export const DEFAULT_AI_SYSTEM_PROMPT =
  "你是一个聊天记录总结助手。请用简洁的要点总结下面的聊天内容，保留关键结论与待办事项，不要编造未出现的信息。";

/** 默认配置：未选择、未填写（目标解析为 null → 跟随「后端」偏好的回退语义）。 */
export const DEFAULT_AI_PROVIDER_CONFIG: AiProviderConfig = {
  providerId: "openai",
  baseUrl: "",
  model: "",
  systemPrompt: "",
  temperature: 0.3,
  timeoutMs: 30000,
  providerChosen: false,
};

/**
 * 单次总结允许的最大消息条数（超出截断，避免超出模型上下文与费用失控；
 * 与宿主 `messages:read` 单次 500 条上限保持一致）。
 */
export const MAX_SUMMARIZE_MESSAGES = 500;

/** 单条消息允许的最大字符数（超出截断）。 */
export const MAX_SUMMARIZE_MESSAGE_CHARS = 4000;

/** OpenAI 兼容 chat message。 */
export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

/** 解析后的可调用目标。 */
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
 * 按 id 读取预设；未知 id 回退到首个预设（openai）。
 *
 * @param id - provider id。
 * @returns 对应预设。
 */
export function getAiProviderPreset(id: AiProviderId): AiProviderPreset {
  return AI_PROVIDER_PRESETS.find((p) => p.id === id) ?? AI_PROVIDER_PRESETS[0]!;
}

/**
 * 数值裁剪（含 NaN / Infinity 兜底）。
 */
function clampNumber(raw: unknown, min: number, max: number, fallback: number): number {
  const num = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * 归一化字符串字段（去首尾空白，非字符串回退）。
 */
function normalizeString(raw: unknown, fallback: string): string {
  return typeof raw === "string" ? raw.trim() : fallback;
}

/**
 * 归一化来自持久化的配置对象（容错，永不抛错）。
 *
 * @param raw - 未知来源的配置。
 * @returns 合法配置；字段非法时逐项回退默认值。
 */
export function normalizeAiProviderConfig(raw: unknown): AiProviderConfig {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_AI_PROVIDER_CONFIG };
  const r = raw as Record<string, unknown>;
  // providerId 容错（trim + 小写后校验），避免手改存储时静默回退到默认预设。
  const rawProviderId =
    typeof r.providerId === "string" ? r.providerId.trim().toLowerCase() : undefined;
  const providerId = isAiProviderId(rawProviderId)
    ? rawProviderId
    : DEFAULT_AI_PROVIDER_CONFIG.providerId;
  return {
    providerId,
    baseUrl: normalizeString(r.baseUrl, ""),
    model: normalizeString(r.model, ""),
    // 提示词保留原样（含首尾空白）：resolveAiTarget 使用时再 trim，避免裁掉用户刻意的换行。
    systemPrompt: typeof r.systemPrompt === "string" ? r.systemPrompt : "",
    temperature: clampNumber(r.temperature, 0, 2, DEFAULT_AI_PROVIDER_CONFIG.temperature),
    timeoutMs: clampNumber(r.timeoutMs, 1000, 120000, DEFAULT_AI_PROVIDER_CONFIG.timeoutMs),
    providerChosen: r.providerChosen === true,
  };
}

/**
 * 解析当前配置对应的可调用目标。
 *
 * 规则：base URL 或模型名为空 → 返回 `null`（配置不完整）；
 * 调用方结合 `providerChosen` 区分「未配置」（可回退）与「配置不完整」（提示补全）。
 *
 * @param config - 归一化后的配置。
 * @returns 可调用目标；不可用时为 `null`。
 */
export function resolveAiTarget(config: AiProviderConfig): AiTarget | null {
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
 * - 按条清空空白后丢弃空项；
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
