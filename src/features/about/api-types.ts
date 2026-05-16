/**
 * @fileoverview about Feature 对外类型。
 */

import type { AppInfo } from "./domain/contracts";

export type { AppInfo };

export type AboutCapabilities = {
  getAppInfo(): AppInfo;
};
