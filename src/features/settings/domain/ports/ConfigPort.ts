/**
 * @fileoverview ConfigPort.ts 文件职责说明。
 */
import type { AppConfig } from "../types/Config";

export interface ConfigPort {
  readRaw(): Promise<string>;
  updateBool(key: string, value: boolean): Promise<void>;
  updateString(key: string, value: string): Promise<void>;
  parse(raw: string): AppConfig;
}

