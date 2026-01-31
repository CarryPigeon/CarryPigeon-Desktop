/**
 * @fileoverview Tauri/Rust 侧日志封装（前端 -> Rust）。
 * @description 在平台边界（TCP/加密等）使用，确保日志进入后端日志系统，便于排障。
 */
import { TAURI_COMMANDS } from "./commands";
import { invokeTauri } from "./invokeClient";

type LogMeta = Record<string, unknown>;

/**
 * formatMeta 方法说明。
 * @param meta? - 参数说明。
 * @returns 返回值说明。
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
 * safeInvoke 方法说明。
 * @param command - 参数说明。
 * @param args - 参数说明。
 * @param unknown> - 参数说明。
 * @returns 返回值说明。
 */
function safeInvoke(command: string, args: Record<string, unknown>) {
  void invokeTauri(command, args).catch(() => {});
}

/**
 * Sends logs to the Rust side via Tauri commands.
 * Use this at the platform boundary (e.g. crypto/TCP) when logs must be persisted with backend logs.
 */
/**
 * @constant
 * @description 将日志发送到 Rust 侧（通过 Tauri commands）。
 */
export const tauriLog = {
  /**
   * debug method.
   * @param message - TODO.
   * @param meta - TODO.
   */
  debug(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logDebug, { msg: `${message}${formatMeta(meta)}` });
  },
  /**
   * info method.
   * @param message - TODO.
   * @param meta - TODO.
   */
  info(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logInfo, { msg: `${message}${formatMeta(meta)}` });
  },
  /**
   * warn method.
   * @param message - TODO.
   * @param meta - TODO.
   */
  warn(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logWarning, { msg: `${message}${formatMeta(meta)}` });
  },
  /**
   * error method.
   * @param message - TODO.
   * @param meta - TODO.
   */
  error(message: string, meta?: LogMeta) {
    safeInvoke(TAURI_COMMANDS.logError, { error: `${message}${formatMeta(meta)}` });
  },
};
