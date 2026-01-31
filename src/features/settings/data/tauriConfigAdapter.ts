/**
 * @fileoverview tauriConfigAdapter.ts 文件职责说明。
 */
import { invokeTauri } from "../../../shared/tauri";
import { DEFAULT_APP_CONFIG, type AppConfig } from "../domain/types/Config";
import type { ConfigPort } from "../domain/ports/ConfigPort";

/**
 * Exported constant.
 * @constant
 */
export const tauriConfigAdapter: ConfigPort = {
  /**
   * readRaw method.
   * @returns TODO.
   */
  async readRaw(): Promise<string> {
    return invokeTauri<string>("get_config");
  },
  /**
   * updateBool method.
   * @param key - TODO.
   * @param value - TODO.
   * @returns TODO.
   */
  async updateBool(key: string, value: boolean): Promise<void> {
    await invokeTauri("update_config_bool", { key, value });
  },
  /**
   * updateString method.
   * @param key - TODO.
   * @param value - TODO.
   * @returns TODO.
   */
  async updateString(key: string, value: string): Promise<void> {
    await invokeTauri("update_config_string", { key, value });
  },
  /**
   * parse method.
   * @param raw - TODO.
   * @returns TODO.
   */
  parse(raw: string): AppConfig {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return DEFAULT_APP_CONFIG;
      return { ...DEFAULT_APP_CONFIG, ...(parsed as Record<string, unknown>) };
    } catch {
      return DEFAULT_APP_CONFIG;
    }
  },
};
