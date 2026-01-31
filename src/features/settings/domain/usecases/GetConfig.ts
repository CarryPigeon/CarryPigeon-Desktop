/**
 * @fileoverview GetConfig.ts 文件职责说明。
 */
import type { AppConfig } from "../types/Config";
import type { ConfigPort } from "../ports/ConfigPort";

export class GetConfig {
  constructor(private readonly config: ConfigPort) {}

  /**
   * execute method.
   * @returns TODO.
   */
  async execute(): Promise<AppConfig> {
    const raw = await this.config.readRaw();
    return this.config.parse(raw);
  }
}

