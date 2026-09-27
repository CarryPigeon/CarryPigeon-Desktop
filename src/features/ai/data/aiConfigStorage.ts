/**
 * @fileoverview ai 配置持久化适配器（localStorage）。
 * @description
 * 仅持久化非敏感配置（provider / base URL / 模型名 / 提示词 / 采样参数）；
 * API Key 绝不落 localStorage，统一由 Rust 侧写入系统凭据管理器。
 */

import { KEY_AI_PROVIDER_CONFIG } from "@/shared/utils/storageKeys";
import { createLogger } from "@/shared/utils/logger";
import { DEFAULT_AI_CONFIG, normalizeAiProviderConfig, type AiProviderConfig } from "../domain/types";

const logger = createLogger("ai-config-storage");

/**
 * 读取 AI provider 配置（容错：损坏/缺失时回退默认值）。
 *
 * @returns 归一化后的配置。
 */
export function loadAiProviderConfig(): AiProviderConfig {
  try {
    const raw = localStorage.getItem(KEY_AI_PROVIDER_CONFIG);
    if (!raw) return { ...DEFAULT_AI_CONFIG };
    return normalizeAiProviderConfig(JSON.parse(raw));
  } catch (e) {
    logger.warn("Action: api_ai_provider_config_load_failed", { error: String(e) });
    return { ...DEFAULT_AI_CONFIG };
  }
}

/**
 * 写入 AI provider 配置（先归一化，避免脏数据落盘）。
 *
 * @param config - 待保存配置。
 * @returns 实际落盘的归一化配置。
 */
export function saveAiProviderConfig(config: AiProviderConfig): AiProviderConfig {
  const normalized = normalizeAiProviderConfig(config);
  try {
    localStorage.setItem(KEY_AI_PROVIDER_CONFIG, JSON.stringify(normalized));
  } catch (e) {
    logger.warn("Action: api_ai_provider_config_save_failed", { error: String(e) });
  }
  return normalized;
}
