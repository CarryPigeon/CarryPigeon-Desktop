/**
 * @fileoverview SetTheme.ts
 * @description Usecase: update theme preference.
 */

import type { ConfigPort } from "../ports/ConfigPort";
import type { AppTheme } from "../types/ConfigTypes";

/**
 * Set theme usecase.
 */
export class SetTheme {
  constructor(private readonly configPort: ConfigPort) {}

  /**
   * Execute set theme.
   *
   * @param theme - Target theme.
   * @returns Promise<void>.
   */
  execute(theme: AppTheme): Promise<void> {
    return this.configPort.setTheme(theme);
  }
}
