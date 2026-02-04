/**
 * @fileoverview ConfigPort.ts
 * @description Domain port: user configuration storage.
 *
 * Implementations:
 * - `localStorage`: browser localStorage backed
 * - `mock`: in-memory for testing
 */

import type { AppTheme, UserConfig } from "../types/ConfigTypes";

/**
 * Configuration port.
 */
export interface ConfigPort {
  /**
   * Get current user configuration.
   *
   * @returns User configuration.
   */
  getConfig(): Promise<UserConfig>;

  /**
   * Set application theme.
   *
   * @param theme - Target theme.
   */
  setTheme(theme: AppTheme): Promise<void>;
}
