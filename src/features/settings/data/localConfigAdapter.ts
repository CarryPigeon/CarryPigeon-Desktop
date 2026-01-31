/**
 * @fileoverview localConfigAdapter.ts 文件职责说明。
 */
import { DEFAULT_APP_CONFIG, type AppConfig } from "../domain/types/Config";
import type { ConfigPort } from "../domain/ports/ConfigPort";
import { readAppConfigRaw, writeAppConfigRaw } from "@/shared/utils/localState";

/**
 * mergeDefaults 方法说明。
 * @param parsed - 参数说明。
 * @returns 返回值说明。
 */
function mergeDefaults(parsed: unknown): AppConfig {
  if (!parsed || typeof parsed !== "object") return DEFAULT_APP_CONFIG;
  return { ...DEFAULT_APP_CONFIG, ...(parsed as Record<string, unknown>) };
}

/**
 * defaultRaw 方法说明。
 * @returns 返回值说明。
 */
function defaultRaw(): string {
  return JSON.stringify(DEFAULT_APP_CONFIG);
}

/**
 * Exported constant.
 * @constant
 */
export const localConfigAdapter: ConfigPort = {
  /**
   * readRaw method.
   * @returns TODO.
   */
  async readRaw(): Promise<string> {
    return readAppConfigRaw(defaultRaw());
  },

  /**
   * updateBool method.
   * @param key - TODO.
   * @param value - TODO.
   * @returns TODO.
   */
  async updateBool(key: string, value: boolean): Promise<void> {
    const raw = readAppConfigRaw(defaultRaw());
    const next = mergeDefaults(safeJsonParse(raw));
    (next as Record<string, unknown>)[key] = value;
    writeAppConfigRaw(JSON.stringify(next));
  },

  /**
   * updateString method.
   * @param key - TODO.
   * @param value - TODO.
   * @returns TODO.
   */
  async updateString(key: string, value: string): Promise<void> {
    const raw = readAppConfigRaw(defaultRaw());
    const next = mergeDefaults(safeJsonParse(raw));
    (next as Record<string, unknown>)[key] = value;
    writeAppConfigRaw(JSON.stringify(next));
  },

  /**
   * parse method.
   * @param raw - TODO.
   * @returns TODO.
   */
  parse(raw: string): AppConfig {
    return mergeDefaults(safeJsonParse(raw));
  },
};

/**
 * safeJsonParse 方法说明。
 * @param raw - 参数说明。
 * @returns 返回值说明。
 */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

