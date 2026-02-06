/**
 * @fileoverview GetConfig.ts
 * @description settings｜用例：GetConfig。
 */

import type { ConfigPort } from "../ports/ConfigPort";
import type { UserConfig } from "../types/ConfigTypes";

/**
 * 用例：获取用户配置。
 */
export class GetConfig {
  constructor(private readonly configPort: ConfigPort) {}

  /**
   * 执行：读取配置存储中的用户配置。
   *
   * @returns 用户配置。
   */
  execute(): Promise<UserConfig> {
    return this.configPort.getConfig();
  }
}
