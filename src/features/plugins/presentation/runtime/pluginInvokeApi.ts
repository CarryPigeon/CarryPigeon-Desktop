/**
 * @fileoverview 插件 invoke 能力工厂（白名单约束）。
 * @description plugins｜runtime：受命令白名单约束的 Tauri 命令调用能力。
 */

import { invokeTauri } from "@/shared/tauri";
import { createLogger } from "@/shared/utils/logger";
import type { PluginScope } from "./pluginScope";

const logger = createLogger("plugin-invoke-api");

/**
 * 判断插件 scope 是否已销毁（已销毁时输出英文告警，含 pluginId）。
 * 供 invoke 能力做 dispose 后的 no-op 防御。
 */
function warnIfScopeDisposed(scope: PluginScope | undefined, pluginId: string): boolean {
  if (scope?.disposed) {
    logger.warn("Action: plugins_scope_disposed_invoke_noop", { pluginId });
    return true;
  }
  return false;
}

/**
 * 创建受白名单约束的插件命令调用能力。
 *
 * 仅当命令以 `allowedPrefix` 开头时才允许调用底层 `invokeTauri`，
 * 否则直接抛错拒绝，避免插件越权调用任意 Tauri 命令。
 *
 * @param serverSocket 当前 server socket（透传给 Rust 侧做隔离）。
 * @param pluginId 插件标识（用于错误日志定位）。
 * @param allowedPrefix 命令白名单前缀（如 "voice_call:"）。
 * @param scope 可选的插件作用域：已销毁后调用变为 no-op（返回 null）并告警。
 * @returns 一个 (command, args?) => Promise<unknown> 的调用函数。
 */
export function createPluginInvokeApi(
  serverSocket: string,
  pluginId: string,
  allowedPrefix: string,
  scope?: PluginScope,
): (command: string, args?: Record<string, unknown>) => Promise<unknown> {
  return async (command: string, args?: Record<string, unknown>) => {
    // scope 已销毁：调用直接 no-op，不触达底层 Tauri 命令
    if (warnIfScopeDisposed(scope, pluginId)) {
      return null;
    }
    if (!command.startsWith(allowedPrefix)) {
      throw new Error(
        `plugin ${pluginId} invoke denied: command "${command}" not under "${allowedPrefix}"`,
      );
    }
    return invokeTauri<unknown>(command, {
      ...(args ?? {}),
      serverSocket,
    });
  };
}
