/**
 * @fileoverview GetConfig.ts
 * @description Usecase: retrieve user configuration.
 */

import type { ConfigPort } from "../ports/ConfigPort";
import type { UserConfig } from "../types/ConfigTypes";

/**
 * Get config usecase.
 */
export class GetConfig {
  constructor(private readonly configPort: ConfigPort) {}

  /**
   * Execute get config.
   *
   * @returns User configuration.
   */
  execute(): Promise<UserConfig> {
    return this.configPort.getConfig();
  }
}
