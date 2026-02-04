/**
 * @fileoverview Tauri/Rust 侧日志封装（前端 -> Rust）。
 * @description 在平台边界（TCP/加密等）使用，确保日志进入后端日志系统，便于排障。
 */
import { TAURI_COMMANDS } from "./commands";
import { invokeTauri } from "./invokeClient";

type LogMeta = Record<string, unknown>;

/**
 * 将结构化元信息序列化为日志字符串片段。
 *
 * @param meta - 可选结构化元信息。
 * @returns 以空格开头的 JSON 字符串；当 meta 不存在时返回空字符串。
 */
function formatMeta(meta?: LogMeta): string {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta_unserializable]";
  }
}

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
    safeInvoke(TAURI_COMMANDS.logDebug, { msg: `${message}${formatMeta(meta)}` });
  },
  info(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logInfo, { msg: `${message}${formatMeta(meta)}` });
  },
  warn(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logWarning, { msg: `${message}${formatMeta(meta)}` });
  },
  error(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logError, { error: `${message}${formatMeta(meta)}` });
  },
};
