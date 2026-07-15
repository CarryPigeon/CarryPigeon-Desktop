/**
 * @fileoverview 插件 invoke 能力工厂（白名单约束）。
 * @description plugins｜runtime：受命令白名单约束的 Tauri 命令调用能力。
 */

import { invokeTauri } from "@/shared/tauri";

/**
 * 创建受白名单约束的插件命令调用能力。
 *
 * 仅当命令以 `allowedPrefix` 开头时才允许调用底层 `invokeTauri`，
 * 否则直接抛错拒绝，避免插件越权调用任意 Tauri 命令。
 *
 * @param serverSocket 当前 server socket（透传给 Rust 侧做隔离）。
 * @param pluginId 插件标识（用于错误日志定位）。
 * @param allowedPrefix 命令白名单前缀（如 "voice_call:"）。
 * @returns 一个 (command, args?) => Promise<unknown> 的调用函数。
 */
export function createPluginInvokeApi(
  serverSocket: string,
  pluginId: string,
  allowedPrefix: string,
): (command: string, args?: Record<string, unknown>) => Promise<unknown> {
  return async (command: string, args?: Record<string, unknown>) => {
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
