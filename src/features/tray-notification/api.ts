/**
 * @fileoverview tray-notification Feature 对外公共 API。
 * @description 提供跨 feature 可依赖的稳定托盘通知能力。
 */

import { createTauriFlashingAdapter } from "./data/tauri/tauriFlashingAdapter";
import { createTauriLocaleAdapter } from "./data/tauri/tauriLocaleAdapter";
import { createTauriPopoverAdapter } from "./data/tauri/tauriPopoverAdapter";
import { createTauriNotificationAdapter } from "./data/tauri/tauriNotificationAdapter";
import { createMockTrayPorts } from "./mock/mockTrayPorts";
import { createTrayNotificationRuntime } from "./composition/createTrayNotificationRuntime";
import type { TrayNotificationDependencies } from "./composition/createTrayNotificationRuntime";
import { IS_MOCK_ENABLED } from "@/shared/config/runtime";
import type { TrayNotificationCapabilities } from "./api-types";

export type { TrayNotificationDependencies };

let cachedCapabilities: TrayNotificationCapabilities | null = null;

/**
 * 组装 tray-notification 对外能力对象。
 *
 * @param deps - 外部依赖注入（来自 chat、settings 等 capability）。
 */
export function createTrayNotificationCapabilities(
  deps: TrayNotificationDependencies,
): TrayNotificationCapabilities {
  const ports = IS_MOCK_ENABLED
    ? createMockTrayPorts()
    : {
        flashing: createTauriFlashingAdapter(),
        locale: createTauriLocaleAdapter(),
        popover: createTauriPopoverAdapter(),
        desktopNotification: createTauriNotificationAdapter(),
      };

  return createTrayNotificationRuntime(ports, deps);
}

/**
 * 获取 tray-notification 的应用级 capability 单例。
 */
export function getTrayNotificationCapabilities(
  deps: TrayNotificationDependencies,
): TrayNotificationCapabilities {
  cachedCapabilities ??= createTrayNotificationCapabilities(deps);
  return cachedCapabilities;
}
