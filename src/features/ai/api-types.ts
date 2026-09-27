/**
 * @fileoverview ai Feature 对外类型与公共契约。
 */

import type {
  AiChatMessage,
  AiProviderConfig,
  AiProviderId,
  AiProviderPreset,
  AiTarget,
} from "./domain/types";
import type {
  ClientAiFailureCode,
  ClientAiSummaryResult,
} from "./application/aiService";
import type { AiListModelsResponse, AiSecretStatus } from "./data/tauriAiTransport";

export type {
  AiChatMessage,
  AiProviderConfig,
  AiProviderId,
  AiProviderPreset,
  AiTarget,
  AiListModelsResponse,
  AiSecretStatus,
  ClientAiFailureCode,
  ClientAiSummaryResult,
};

export {
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_CONFIG,
  DEFAULT_AI_SYSTEM_PROMPT,
  isAiProviderId,
  getAiProviderPreset,
  normalizeAiProviderConfig,
  resolveAiTarget,
  buildSummarizeMessages,
} from "./domain/types";

/**
 * 客户端 AI 就绪状态快照。
 */
export type ClientAiStatus = Awaited<ReturnType<
  typeof import("./application/aiService").getClientAiStatus
>>;

/**
 * ai feature 跨 feature 公共能力面。
 *
 * 说明：
 * - 该 capability 是插件宿主 `host.ai` 与设置页 UI 的共同实现来源；
 * - API Key 只经 `saveSecret` 单向写入 Rust 侧凭据管理器，任何读取接口都不返回明文。
 */
export type AiCapabilities = {
  /** 读取当前 provider 配置。 */
  getConfig(): AiProviderConfig;
  /** 保存 provider 配置（返回归一化后的结果）。 */
  saveConfig(config: AiProviderConfig): AiProviderConfig;
  /** 读取"是否已由客户端 AI 接管 / 是否就绪"状态快照。 */
  getStatus(config?: AiProviderConfig): Promise<ClientAiStatus>;
  /** 查询指定 provider 是否已配置密钥。 */
  getSecretStatus(providerId: AiProviderId): Promise<AiSecretStatus>;
  /** 写入指定 provider 的 API Key（只写不读）。 */
  saveSecret(providerId: AiProviderId, apiKey: string): Promise<void>;
  /** 清除指定 provider 的 API Key。 */
  clearSecret(providerId: AiProviderId): Promise<void>;
  /** 拉取模型列表（`GET {baseUrl}/models`）。 */
  fetchModels(config: AiProviderConfig): Promise<AiListModelsResponse>;
  /** 使用客户端配置的 provider 生成总结。 */
  summarize(channelId: string, messages: readonly string[]): Promise<ClientAiSummaryResult>;
};
