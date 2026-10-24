/**
 * @fileoverview ai-summary 自管 provider 配置状态（模块级，供设置项与总结面板共享）。
 * @description
 * 从宿主「AI 服务」设置迁移：非敏感配置经 `ctx.storage` 按 server 持久化；
 * API Key 不在此模块——由设置项经 `ctx.secrets` 写入系统凭据管理器。
 *
 * - 读：首次 `ensureProviderLoaded()` 从 `ctx.storage` 载入（失败/未绑定 → 默认配置）；
 * - 写：`saveProviderConfig()` 先更新响应式状态（UI 立即反馈），再异步持久化；
 * - 设置项组件绑定 `useProviderConfig()`，总结面板在请求前 `await ensureProviderLoaded()`。
 */

import { ref, type Ref } from "vue";
import { getContext } from "./bridge";
import {
  normalizeAiProviderConfig,
  type AiProviderConfig,
} from "../domain/aiProvider";
import { createLogger } from "../shared/logger";

const logger = createLogger("providerConfig");

/** 配置持久化 key（`ctx.storage` 命名空间按 serverId + pluginId 隔离）。 */
export const PROVIDER_CONFIG_STORAGE_KEY = "ai_summary.provider";

const config = ref<AiProviderConfig>(normalizeAiProviderConfig(null));
/** 是否已从存储载入（幂等标记）。 */
let loaded = false;
/** 进行中的载入 promise（并发去重）。 */
let loading: Promise<AiProviderConfig> | null = null;

/**
 * 获取可绑定的配置 ref（设置项组件用）。
 *
 * @returns 响应式配置。
 */
export function useProviderConfig(): Ref<AiProviderConfig> {
  return config;
}

/**
 * 确保配置已从插件存储载入（幂等；并发调用复用同一 promise）。
 *
 * @returns 载入后的配置；失败/未绑定上下文时返回默认配置。
 */
export async function ensureProviderLoaded(): Promise<AiProviderConfig> {
  if (loaded) return config.value;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await getContext().storage.get(PROVIDER_CONFIG_STORAGE_KEY);
      config.value = normalizeAiProviderConfig(raw);
    } catch (error) {
      logger.warn("ai_summary_provider_config_load_failed", { error: String(error) });
      config.value = normalizeAiProviderConfig(null);
    } finally {
      loaded = true;
      loading = null;
    }
    return config.value;
  })();
  return loading;
}

/**
 * 写入配置（先归一化并更新状态，再异步持久化）。
 *
 * @param next - 待保存配置。
 * @returns 实际生效的归一化配置。
 */
export function applyProviderConfig(next: AiProviderConfig): AiProviderConfig {
  config.value = normalizeAiProviderConfig(next);
  loaded = true;
  void (async () => {
    try {
      await getContext().storage.set(PROVIDER_CONFIG_STORAGE_KEY, config.value);
    } catch (error) {
      logger.warn("ai_summary_provider_config_save_failed", { error: String(error) });
    }
  })();
  return config.value;
}

/**
 * 重置模块级状态（仅供测试隔离；生产代码不要调用）。
 *
 * @param value - 重置后的配置（缺省默认配置）。
 */
export function resetProviderConfigForTests(value: AiProviderConfig | null = null): void {
  config.value = normalizeAiProviderConfig(value);
  loaded = false;
  loading = null;
}
