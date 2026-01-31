/**
 * @fileoverview configFacade.ts 文件职责说明。
 */
import { getGetConfigUsecase, getUpdateConfigUsecase } from "../di/settings.di";
import { shallowRef } from "vue";
import type { AppConfig } from "../domain/types/Config";
import { DEFAULT_APP_CONFIG } from "../domain/types/Config";

/**
 * Exported constant.
 * @constant
 */
export const configPath: string = "./config";

/**
 * Reactive app config for presentation layer.
 * - Initialized with defaults
 * - Updated by `ensureConfigLoaded()` / `changeConfig()`
 * @constant
 */
export const configRef = shallowRef<AppConfig>(DEFAULT_APP_CONFIG);

let loadPromise: Promise<AppConfig> | null = null;

/**
 * ensureConfigLoaded 方法说明。
 * @returns 返回值说明。
 */
export function ensureConfigLoaded(): Promise<AppConfig> {
  if (loadPromise) return loadPromise;
  loadPromise = getGetConfigUsecase()
    .execute()
    .then((cfg) => {
      configRef.value = cfg;
      return cfg;
    })
    .catch((e) => {
      loadPromise = null;
      throw e;
    });
  return loadPromise;
}

/**
 * changeConfig 方法说明。
 * @param key - 参数说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
export async function changeConfig(key: string, value: string | boolean) {
  const next = await getUpdateConfigUsecase().execute(key, value);
  configRef.value = next;
  return next;
}

export { ensureConfigLoaded as getConfig };

// Kick off initial load in background.
void ensureConfigLoaded();
