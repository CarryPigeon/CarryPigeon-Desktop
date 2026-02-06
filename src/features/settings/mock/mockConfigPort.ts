/**
 * @fileoverview mockConfigPort.ts
 * @description settings｜Mock 实现：mockConfigPort（用于本地预览/测试）。
 */

import { MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import type { ConfigPort } from "../domain/ports/ConfigPort";
import type { AppTheme, UserConfig } from "../domain/types/ConfigTypes";

let mockTheme: AppTheme = "patchbay";

/**
 * Mock implementation of ConfigPort.
 *
 * @constant
 */
export const mockConfigPort: ConfigPort = {
  async getConfig(): Promise<UserConfig> {
    await sleep(MOCK_LATENCY_MS);
    return {
      theme: mockTheme,
    };
  },

  async setTheme(theme: AppTheme): Promise<void> {
    await sleep(MOCK_LATENCY_MS);
    mockTheme = theme;
  },
};
