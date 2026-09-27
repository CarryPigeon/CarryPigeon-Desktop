/**
 * @fileoverview ai Feature 对外公共 API。
 * @description
 * 以 object-capability 形式暴露"客户端 AI provider"能力，供设置页与插件宿主消费。
 */

import type { AiCapabilities } from "./api-types";
import {
  fetchAiModels,
  getAiProviderConfig,
  getClientAiStatus,
  getProviderSecretStatus,
  removeProviderSecret,
  saveProviderSecret,
  summarizeWithClientAi,
  updateAiProviderConfig,
} from "./application/aiService";

// 对外同时暴露类型与预设常量，使消费方只需 `@/features/ai/api` 一个入口。
export * from "./api-types";

/**
 * 构造 ai capability（无状态，可直接复用）。
 *
 * @returns ai capability 实例。
 */
export function createAiCapabilities(): AiCapabilities {
  return {
    getConfig: () => getAiProviderConfig(),
    saveConfig: (config) => updateAiProviderConfig(config),
    getStatus: (config) => getClientAiStatus(config),
    getSecretStatus: (providerId) => getProviderSecretStatus(providerId),
    saveSecret: (providerId, apiKey) => saveProviderSecret(providerId, apiKey),
    clearSecret: (providerId) => removeProviderSecret(providerId),
    fetchModels: (config) => fetchAiModels(config),
    summarize: (channelId, messages) => summarizeWithClientAi(channelId, messages),
  };
}

let aiCapabilities: AiCapabilities | null = null;

/**
 * 获取共享 ai capability 单例。
 *
 * @returns ai capability 实例。
 */
export function getAiCapabilities(): AiCapabilities {
  aiCapabilities ??= createAiCapabilities();
  return aiCapabilities;
}
