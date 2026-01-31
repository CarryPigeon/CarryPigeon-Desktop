/**
 * @fileoverview UpdateConfig.ts 文件职责说明。
 */
import type { AppConfig } from "../types/Config";
import type { ConfigPort } from "../ports/ConfigPort";

export class UpdateConfig {
  constructor(private readonly config: ConfigPort) {}

  /**
   * execute method.
   * @param key - TODO.
   * @param value - TODO.
   * @returns TODO.
   */
  async execute(key: string, value: string | boolean): Promise<AppConfig> {
    if (typeof value === "boolean") await this.config.updateBool(key, value);
    else await this.config.updateString(key, value);

    const raw = await this.config.readRaw();
    return this.config.parse(raw);
  }
}

