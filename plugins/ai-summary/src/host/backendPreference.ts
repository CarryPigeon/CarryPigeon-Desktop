/**
 * @fileoverview ai-summary 后端偏好状态（模块级，供设置项与总结面板共享）。
 * @description
 * - 读：首次 `ensureBackendLoaded()` 从 `ctx.storage` 载入（失败/未绑定 → 保持 `auto`）；
 * - 写：`setBackend()` 先更新响应式状态（设置项 UI 立即反馈），再异步持久化；
 * - 设置项组件绑定 `useBackendPreference()`，总结面板在请求前 `await ensureBackendLoaded()`。
 */

import { ref, type Ref } from "vue";
import { getContext } from "./bridge";
import {
  parseSummarizeBackend,
  SUMMARIZE_BACKEND_STORAGE_KEY,
  type SummarizeBackend,
} from "../domain/summarizeBackend";
import { createLogger } from "../shared/logger";

const logger = createLogger("backendPreference");

const backend = ref<SummarizeBackend>("auto");
/** 是否已从存储载入（幂等标记）。 */
let loaded = false;
/** 进行中的载入 promise（并发去重）。 */
let loading: Promise<SummarizeBackend> | null = null;

/**
 * 读取当前后端偏好（同步，返回最新已知值）。
 *
 * @returns 当前偏好。
 */
export function getBackend(): SummarizeBackend {
  return backend.value;
}

/**
 * 获取可绑定的后端偏好 ref（设置项组件用）。
 *
 * @returns 响应式偏好。
 */
export function useBackendPreference(): Ref<SummarizeBackend> {
  return backend;
}

/**
 * 确保偏好已从插件存储载入（幂等；并发调用复用同一 promise）。
 *
 * @returns 载入后的偏好；失败/未绑定上下文时返回 `auto`。
 */
export async function ensureBackendLoaded(): Promise<SummarizeBackend> {
  if (loaded) return backend.value;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await getContext().storage.get(SUMMARIZE_BACKEND_STORAGE_KEY);
      backend.value = parseSummarizeBackend(raw);
    } catch (error) {
      logger.warn("ai_summary_backend_load_failed", { error: String(error) });
      backend.value = "auto";
    } finally {
      loaded = true;
      loading = null;
    }
    return backend.value;
  })();
  return loading;
}

/**
 * 写入偏好（先更新状态，再异步持久化；持久化失败仅告警）。
 *
 * @param next - 目标偏好。
 * @returns 持久化是否成功（失败时已记录告警，调用方可提示用户）。
 */
export async function setBackend(next: SummarizeBackend): Promise<boolean> {
  backend.value = parseSummarizeBackend(next);
  loaded = true;
  try {
    await getContext().storage.set(SUMMARIZE_BACKEND_STORAGE_KEY, backend.value);
    return true;
  } catch (error) {
    logger.warn("ai_summary_backend_save_failed", { error: String(error) });
    return false;
  }
}

/**
 * 重置模块级状态（仅供测试隔离；生产代码不要调用）。
 *
 * @param value - 重置后的偏好值（缺省 `auto`）。
 */
export function resetBackendPreferenceForTests(value: SummarizeBackend = "auto"): void {
  backend.value = value;
  loaded = false;
  loading = null;
}
