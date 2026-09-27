/**
 * @fileoverview ai 传输适配器：调用 Rust 侧 OpenAI 兼容命令。
 * @description
 * 全部 HTTP 出口都在 Rust（reqwest）完成，原因：
 * - WebView 直接请求第三方会受 CORS/混合内容限制；
 * - API Key 只存在系统凭据管理器，永不下发到 WebView 或插件沙箱。
 *
 * 该文件只做 invoke 封装与形状归一化，不含业务策略。
 */

import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import type { AiChatMessage } from "../domain/types";

/** `ai_secret_status` 返回体。 */
export type AiSecretStatus = {
  configured: boolean;
  secureStorageAvailable: boolean;
};

/** `ai_chat_completion` 返回体（camelCase，与 Rust DTO 对齐）。 */
export type AiChatCompletionResponse = {
  ok: boolean;
  status: number;
  content: string;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  error?: string | null;
};

/** `ai_list_models` 返回体。 */
export type AiListModelsResponse = {
  ok: boolean;
  status: number;
  models: string[];
  error?: string | null;
};

/**
 * 把时间戳/数字字段归一化为有限数值或 null。
 *
 * @param raw - 原始值。
 * @returns 有限数值或 null。
 */
function toOptionalNumber(raw: unknown): number | null {
  const num = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(num) ? num : null;
}

/**
 * 写入指定 provider 的 API Key（只写不读，无法回读明文）。
 *
 * @param providerId - provider id。
 * @param apiKey - API Key 明文（仅本次调用传入，Rust 侧写入凭据管理器）。
 */
export async function setAiSecret(providerId: string, apiKey: string): Promise<void> {
  await invokeTauri<void>(TAURI_COMMANDS.aiSecretSet, { providerId, apiKey });
}

/**
 * 查询指定 provider 是否已配置 API Key。
 *
 * @param providerId - provider id。
 * @returns 配置状态；查询失败时返回"未配置且安全存储不可用"。
 */
export async function getAiSecretStatus(providerId: string): Promise<AiSecretStatus> {
  try {
    const res = await invokeTauri<AiSecretStatus>(TAURI_COMMANDS.aiSecretStatus, { providerId });
    return {
      configured: Boolean(res?.configured),
      secureStorageAvailable: res?.secureStorageAvailable !== false,
    };
  } catch {
    return { configured: false, secureStorageAvailable: false };
  }
}

/**
 * 清除指定 provider 的 API Key。
 *
 * @param providerId - provider id。
 */
export async function clearAiSecret(providerId: string): Promise<void> {
  await invokeTauri<void>(TAURI_COMMANDS.aiSecretClear, { providerId });
}

/**
 * 发起一次 OpenAI 兼容 chat completion。
 *
 * @param args - 调用参数。
 * @returns 归一化后的响应。
 */
export async function chatCompletion(args: {
  providerId: string;
  baseUrl: string;
  model: string;
  messages: readonly AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requiresApiKey?: boolean;
}): Promise<AiChatCompletionResponse> {
  const res = await invokeTauri<AiChatCompletionResponse>(TAURI_COMMANDS.aiChatCompletion, {
    providerId: args.providerId,
    baseUrl: args.baseUrl,
    model: args.model,
    messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: args.temperature,
    maxTokens: args.maxTokens,
    timeoutMs: args.timeoutMs,
    requiresApiKey: args.requiresApiKey,
  });
  return {
    ok: Boolean(res?.ok),
    status: toOptionalNumber(res?.status) ?? 0,
    content: typeof res?.content === "string" ? res.content : "",
    model: typeof res?.model === "string" ? res.model : null,
    promptTokens: toOptionalNumber(res?.promptTokens),
    completionTokens: toOptionalNumber(res?.completionTokens),
    error: typeof res?.error === "string" ? res.error : null,
  };
}

/**
 * 拉取 provider 的模型列表（`GET {baseUrl}/models`）。
 *
 * @param args - 调用参数。
 * @returns 归一化后的模型列表响应。
 */
export async function listAiModels(args: {
  providerId: string;
  baseUrl: string;
  timeoutMs?: number;
  requiresApiKey?: boolean;
}): Promise<AiListModelsResponse> {
  const res = await invokeTauri<AiListModelsResponse>(TAURI_COMMANDS.aiListModels, {
    providerId: args.providerId,
    baseUrl: args.baseUrl,
    timeoutMs: args.timeoutMs,
    requiresApiKey: args.requiresApiKey,
  });
  const models = Array.isArray(res?.models)
    ? res.models.filter((m): m is string => typeof m === "string" && m.trim() !== "")
    : [];
  return {
    ok: Boolean(res?.ok),
    status: toOptionalNumber(res?.status) ?? 0,
    models,
    error: typeof res?.error === "string" ? res.error : null,
  };
}
