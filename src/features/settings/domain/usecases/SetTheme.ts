/**
 * @fileoverview SetTheme.ts
 * @description settings｜用例：SetTheme。
 */

import type { ConfigPort } from "../ports/ConfigPort";
import type { AppTheme } from "../types/ConfigTypes";

/**
 * 用例：设置应用主题。
 */
export class SetTheme {
  constructor(private readonly configPort: ConfigPort) {}

  /**
   * 执行：将主题写入配置存储。
   *
   * @param theme - 目标主题。
   * @returns 无返回值。
   */
  execute(theme: AppTheme): Promise<void> {
    return this.configPort.setTheme(theme);
  }
}
