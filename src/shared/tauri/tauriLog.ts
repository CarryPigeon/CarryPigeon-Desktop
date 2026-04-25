/**
 * @fileoverview Tauri/Rust 侧日志封装（前端 -> Rust）。
 * @description 在平台边界（TCP/加密等）使用，确保日志进入后端日志系统，便于排障。
 */
import { TAURI_COMMANDS } from "./commands";
import { invokeTauri } from "./invokeClient";
import { buildMessage, type LogMeta } from "./tauriLogCore";

export type { LogMeta } from "./tauriLogCore";

/**
 * 尽力而为（best-effort）地调用 Rust 侧命令。
 *
 * 约束：日志链路不应导致 UI 崩溃，因此调用失败会被吞掉。
 *
 * @param command - Tauri command 名。
 * @param args - command 参数。
 */
function safeInvoke(command: string, args: Record<string, unknown>): void {
  void invokeTauri(command, args).catch(() => {});
}

/**
 * 通过 Tauri commands 将日志转发到 Rust 侧的 logger。
 *
 * 适用场景：平台边界（例如 crypto/TCP 等）需要与后端日志合并持久化时，用于排障定位。
 *
 * @constant
 */
export const tauriLog = {
  debug(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logDebug, { message: buildMessage(message, meta) });
  },
  info(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logInfo, { message: buildMessage(message, meta) });
  },
  warn(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logWarning, { message: buildMessage(message, meta) });
  },
  error(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logError, { message: buildMessage(message, meta) });
  },
};
