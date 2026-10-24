/**
 * @fileoverview ai-summary 自配 provider 调用编排（宿主能力之上的应用层）。
 * @description
 * 从宿主 `host.ai.summarize` 能力迁移为插件自编排：
 * 读取自管配置 → 目标解析 → 密钥预检 → `ctx.network.fetch` 直连 OpenAI 兼容端点 → 解析归一化。
 *
 * 安全说明：认证头为 `Bearer @secret(api_key)` 引用，密钥明文由宿主 Rust 侧从系统
 * 凭据管理器解析替换；本模块（与插件任何代码）都不接触密钥明文。
 *
 * 本模块不抛错：所有失败以 `{ ok: false, code }` 返回，便于面板分支处理
 * （是否回退服务端由 summarizeBackend 的计划决定）。
 */

import { getContext } from "./bridge";
import { ensureProviderLoaded } from "./providerConfig";
import {
  buildSummarizeMessages,
  getAiProviderPreset,
  resolveAiTarget,
} from "../domain/aiProvider";
import {
  API_KEY_SECRET_NAME,
  buildAuthHeaders,
  buildChatCompletionBody,
  buildChatCompletionsUrl,
  buildModelsUrl,
  parseChatCompletionResponse,
  parseModelsResponse,
} from "../domain/openaiClient";
import type { ClientAiFailureCode } from "../domain/summarizeBackend";
import { createLogger } from "../shared/logger";

const logger = createLogger("clientAi");

/** 自配 provider 总结结果。 */
export type ClientAiSummaryResult =
  | {
      ok: true;
      summary: string;
      messageCount: number;
      provider: string;
      model: string;
    }
  | {
      ok: false;
      code: ClientAiFailureCode;
      error: string;
      status?: number;
      provider?: string;
    };

/** 密钥状态（与宿主 `ctx.secrets.status` 同形；能力缺失时按不可用处理）。 */
export type ProviderSecretStatus = {
  configured: boolean;
  secureStorageAvailable: boolean;
};

/**
 * 查询 API Key 状态（不发起网络请求）。
 *
 * @returns 密钥状态；`ctx.secrets` 未注入（旧宿主）时按"未配置且存储不可用"处理。
 */
export async function getProviderSecretStatus(): Promise<ProviderSecretStatus> {
  try {
    return await getContext().secrets?.status(API_KEY_SECRET_NAME) ?? {
      configured: false,
      secureStorageAvailable: false,
    };
  } catch (error) {
    logger.warn("ai_summary_secret_status_failed", { error: String(error) });
    return { configured: false, secureStorageAvailable: false };
  }
}

/**
 * 用自配 provider 生成总结。
 *
 * @param messages - 待总结消息（已按范围收敛）。
 * @returns 总结结果（失败含分类码，调用方据此决定回退/提示）。
 */
export async function summarizeWithProvider(
  messages: readonly string[],
): Promise<ClientAiSummaryResult> {
  const cfg = await ensureProviderLoaded();
  const preset = getAiProviderPreset(cfg.providerId);
  const target = resolveAiTarget(cfg);

  if (!target) {
    return cfg.providerChosen
      ? {
          ok: false,
          code: "incomplete-config",
          error: "base url or model is empty",
          provider: preset.label,
        }
      : { ok: false, code: "not-configured", error: "provider is not configured" };
  }

  const chatMessages = buildSummarizeMessages(messages, target.systemPrompt);
  if (chatMessages.length === 0) {
    return {
      ok: false,
      code: "incomplete-config",
      error: "no messages to summarize",
      provider: preset.label,
    };
  }

  if (target.requiresApiKey) {
    const secret = await getProviderSecretStatus();
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

  return requestChatCompletion({
    baseUrl: target.baseUrl,
    model: target.model,
    messages: chatMessages,
    temperature: target.temperature,
    timeoutMs: target.timeoutMs,
    withAuth: target.requiresApiKey,
    providerLabel: preset.label,
    messageCount: messages.length,
  });
}

/**
 * 拉取自配 base URL 下的模型列表（`GET {baseUrl}/models`，避免写死模型名过期）。
 *
 * @returns 模型列表响应；base URL 为空或请求失败时返回失败结果。
 */
export async function fetchProviderModels(input: {
  baseUrl: string;
  timeoutMs?: number;
  requiresApiKey: boolean;
}): Promise<{ ok: boolean; status: number; models: string[]; error?: string }> {
  const baseUrl = input.baseUrl.trim();
  if (!baseUrl) {
    return { ok: false, status: 0, models: [], error: "base url is empty" };
  }
  try {
    const res = await getContext().network?.fetch(buildModelsUrl(baseUrl), {
      method: "GET",
      headers: input.requiresApiKey ? buildAuthHeaders() : {},
      timeoutMs: input.timeoutMs,
    });
    if (!res) {
      return { ok: false, status: 0, models: [], error: "network capability is unavailable" };
    }
    if (!res.ok) {
      const parsed = parseModelsResponse(res.status, res.bodyText);
      return {
        ok: false,
        status: res.status,
        models: [],
        error: parsed.ok ? `HTTP ${res.status}` : parsed.error,
      };
    }
    const parsed = parseModelsResponse(res.status, res.bodyText);
    return parsed.ok
      ? { ok: true, status: res.status, models: parsed.models }
      : { ok: false, status: res.status, models: [], error: parsed.error };
  } catch (error) {
    logger.warn("ai_summary_models_request_failed", { error: String(error) });
    return { ok: false, status: 0, models: [], error: String(error) };
  }
}

/**
 * 发起 chat/completions 请求并归一化结果。
 */
async function requestChatCompletion(input: {
  baseUrl: string;
  model: string;
  messages: ReturnType<typeof buildSummarizeMessages>;
  temperature: number;
  timeoutMs: number;
  withAuth: boolean;
  providerLabel: string;
  messageCount: number;
}): Promise<ClientAiSummaryResult> {
  try {
    const res = await getContext().network?.fetch(buildChatCompletionsUrl(input.baseUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(input.withAuth ? buildAuthHeaders() : {}),
      },
      body: JSON.stringify(
        buildChatCompletionBody({
          model: input.model,
          messages: input.messages,
          temperature: input.temperature,
        }),
      ),
      timeoutMs: input.timeoutMs,
    });
    if (!res) {
      return {
        ok: false,
        code: "request-failed",
        error: "network capability is unavailable",
        provider: input.providerLabel,
      };
    }
    const parsed = parseChatCompletionResponse(res.status, res.bodyText);
    if (!res.ok || !parsed.ok) {
      logger.warn("ai_summary_client_request_failed", {
        status: res.status,
        error: parsed.ok ? "" : parsed.error,
      });
      return {
        ok: false,
        code: "request-failed",
        error: parsed.ok ? `HTTP ${res.status}` : parsed.error,
        status: res.status,
        provider: input.providerLabel,
      };
    }
    return {
      ok: true,
      summary: parsed.content,
      messageCount: input.messageCount,
      provider: input.providerLabel,
      model: parsed.model || input.model,
    };
  } catch (error) {
    // fetch 抛错（IPC 失败 / 跨源被拒 / 密钥引用缺失等）：归入请求失败。
    logger.warn("ai_summary_client_invoke_failed", { error: String(error) });
    return {
      ok: false,
      code: "request-failed",
      error: String(error),
      provider: input.providerLabel,
    };
  }
}
