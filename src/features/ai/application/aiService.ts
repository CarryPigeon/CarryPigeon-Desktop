/**
 * @fileoverview ai application service：客户端 AI provider 的读写与总结调用。
 * @description
 * 收敛"配置读取 → 目标解析 → 密钥检查 → 调用 → 结果归一化"的编排逻辑，
 * 使 UI 与插件宿主 capability 共用同一条路径（避免两处各写一份策略）。
 */

import { createLogger } from "@/shared/utils/logger";
import { loadAiProviderConfig, saveAiProviderConfig } from "../data/aiConfigStorage";
import {
  chatCompletion,
  clearAiSecret,
  getAiSecretStatus,
  listAiModels,
  setAiSecret,
  type AiListModelsResponse,
  type AiSecretStatus,
} from "../data/tauriAiTransport";
import {
  buildSummarizeMessages,
  getAiProviderPreset,
  resolveAiTarget,
  type AiProviderConfig,
  type AiProviderId,
} from "../domain/types";

const logger = createLogger("ai-service");

/**
 * 客户端 AI 调用失败原因分类（调用方据此决定"回退服务端"还是"提示用户"）。
 *
 * - `not-configured`：用户选择跟随服务端（默认），应回退到 `/api/ai/summarize`；
 * - `incomplete-config`：已选 provider 但 base URL / 模型名为空；
 * - `api-key-missing`：当前 provider 需要密钥但尚未配置；
 * - `request-failed`：请求已发出但失败（含上游 4xx/5xx 与传输错误）。
 */
export type ClientAiFailureCode =
  | "not-configured"
  | "incomplete-config"
  | "api-key-missing"
  | "request-failed";

/** 客户端 AI 总结结果。 */
export type ClientAiSummaryResult =
  | {
      ok: true;
      summary: string;
      messageCount: number;
      provider: string;
      providerId: AiProviderId;
      model: string;
    }
  | {
      ok: false;
      code: ClientAiFailureCode;
      error: string;
      status?: number;
      /** 当前 provider 展示名（用于 UI 拼装可操作提示）。 */
      provider?: string;
    };

/**
 * 读取当前 AI provider 配置。
 *
 * @returns 归一化后的配置。
 */
export function getAiProviderConfig(): AiProviderConfig {
  return loadAiProviderConfig();
}

/**
 * 保存 AI provider 配置。
 *
 * @param config - 待保存配置。
 * @returns 实际落盘的归一化配置。
 */
export function updateAiProviderConfig(config: AiProviderConfig): AiProviderConfig {
  return saveAiProviderConfig(config);
}

/**
 * 查询指定 provider 的密钥状态。
 *
 * @param providerId - provider id。
 * @returns 密钥状态。
 */
export async function getProviderSecretStatus(providerId: AiProviderId): Promise<AiSecretStatus> {
  return getAiSecretStatus(providerId);
}

/**
 * 保存指定 provider 的 API Key（只写不读）。
 *
 * @param providerId - provider id。
 * @param apiKey - API Key 明文。
 */
export async function saveProviderSecret(providerId: AiProviderId, apiKey: string): Promise<void> {
  await setAiSecret(providerId, apiKey);
}

/**
 * 清除指定 provider 的 API Key。
 *
 * @param providerId - provider id。
 */
export async function removeProviderSecret(providerId: AiProviderId): Promise<void> {
  await clearAiSecret(providerId);
}

/**
 * 拉取当前配置 base URL 下的模型列表（用于避免写死模型名）。
 *
 * @param config - 当前配置。
 * @returns 模型列表响应；配置不完整时返回失败结果。
 */
export async function fetchAiModels(config: AiProviderConfig): Promise<AiListModelsResponse> {
  const baseUrl = config.baseUrl.trim();
  if (!baseUrl) {
    return { ok: false, status: 0, models: [], error: "base url is empty" };
  }
  const preset = getAiProviderPreset(config.providerId);
  return listAiModels({
    providerId: config.providerId,
    baseUrl,
    timeoutMs: config.timeoutMs,
    requiresApiKey: preset.requiresApiKey,
  });
}

/**
 * 组装"当前客户端 AI 就绪状态"快照（设置页与插件提示共用）。
 *
 * @param config - 当前配置（缺省读取持久化配置）。
 * @returns 状态快照。
 */
export async function getClientAiStatus(config?: AiProviderConfig): Promise<{
  /** 当前是否由客户端 AI 接管总结。 */
  active: boolean;
  /** 是否已就绪（可立即发起总结）。 */
  ready: boolean;
  providerId: AiProviderId;
  providerLabel: string;
  baseUrl: string;
  model: string;
  secretConfigured: boolean;
  secureStorageAvailable: boolean;
  hint: string;
}> {
  const cfg = config ?? loadAiProviderConfig();
  const preset = getAiProviderPreset(cfg.providerId);
  const target = resolveAiTarget(cfg);
  const secret = await getAiSecretStatus(cfg.providerId);
  const base = {
    providerId: cfg.providerId,
    providerLabel: preset.label,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    secretConfigured: secret.configured,
    secureStorageAvailable: secret.secureStorageAvailable,
    hint: preset.hint,
  };
  if (!target) {
    return { ...base, active: false, ready: false };
  }
  const ready = !preset.requiresApiKey || secret.configured;
  return { ...base, active: true, ready };
}

/**
 * 用客户端配置的 provider 生成总结。
 *
 * 说明：
 * - 本函数不抛错：所有失败以 `{ ok: false, code }` 返回，便于调用方分支处理；
 * - 调用前会拒绝空消息集，避免空请求打到付费接口。
 *
 * @param channelId - 频道 id（仅用于日志与结果标注）。
 * @param messages - 待总结消息。
 * @returns 总结结果。
 */
export async function summarizeWithClientAi(
  channelId: string,
  messages: readonly string[],
): Promise<ClientAiSummaryResult> {
  const cfg = loadAiProviderConfig();
  const preset = getAiProviderPreset(cfg.providerId);
  const target = resolveAiTarget(cfg);

  if (cfg.providerId === "server") {
    return { ok: false, code: "not-configured", error: "client ai provider is not configured" };
  }
  if (!target) {
    return {
      ok: false,
      code: "incomplete-config",
      error: "base url or model is empty",
      provider: preset.label,
    };
  }

  const chatMessages = buildSummarizeMessages(messages, target.systemPrompt);
  if (chatMessages.length === 0) {
    return { ok: false, code: "incomplete-config", error: "no messages to summarize", provider: preset.label };
  }

  if (target.requiresApiKey) {
    // 密钥查询本身失败（非 Tauri 运行环境 / IPC 异常）时按"未配置"处理：
    // 宁可提示用户去配置，也不要把异常抛进插件运行时。
    let secret: AiSecretStatus = { configured: false, secureStorageAvailable: false };
    try {
      secret = await getAiSecretStatus(target.providerId);
    } catch (e) {
      logger.warn("Action: api_ai_secret_status_failed", { provider: target.providerId, error: String(e) });
    }
    if (!secret.configured) {
      return {
        ok: false,
        code: "api-key-missing",
        error: secret.secureStorageAvailable
          ? "api key is not configured"
          : "secure storage is unavailable",
        provider: preset.label,
      };
    }
  }

  let res;
  try {
    res = await chatCompletion({
      providerId: target.providerId,
      baseUrl: target.baseUrl,
      model: target.model,
      messages: chatMessages,
      temperature: target.temperature,
      timeoutMs: target.timeoutMs,
      requiresApiKey: target.requiresApiKey,
    });
  } catch (e) {
    // invoke 层异常（非 Tauri 运行环境 / IPC 失败）：归入请求失败，交由调用方提示。
    logger.error("Action: api_ai_summarize_invoke_failed", { channelId, error: String(e) });
    return { ok: false, code: "request-failed", error: String(e), provider: preset.label };
  }

  if (!res.ok) {
    logger.warn("Action: api_ai_summarize_request_failed", {
      channelId,
      provider: target.providerId,
      status: res.status,
    });
    return {
      ok: false,
      code: "request-failed",
      error: res.error ?? "request failed",
      status: res.status,
      provider: preset.label,
    };
  }

  const summary = res.content.trim();
  if (!summary) {
    return {
      ok: false,
      code: "request-failed",
      error: "empty completion content",
      status: res.status,
      provider: preset.label,
    };
  }

  return {
    ok: true,
    summary,
    messageCount: messages.length,
    provider: preset.label,
    providerId: target.providerId,
    model: res.model?.trim() || target.model,
  };
}
