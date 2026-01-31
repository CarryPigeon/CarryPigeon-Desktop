/**
 * @fileoverview 前端日志工具（console 统一出口）。
 * @description 业务代码不应直接使用 `console.*`，而应使用 `createLogger(scope)` 输出结构化日志。
 */
type LogMeta = Record<string, unknown>;

/**
 * Frontend logger (console-based).
 *
 * Conventions:
 * - Prefer `createLogger("ScopeName")` per module/component.
 * - Pass structured `meta` instead of string concatenation.
 * - `debug()` logs are dev-only; `info/warn/error` stay enabled.
 * - Do not use `console.*` directly outside this module.
 */
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
 * nowIso 方法说明。
 * @returns 返回值说明。
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * prefix 方法说明。
 * @param level - 参数说明。
 * @param scope? - 参数说明。
 * @returns 返回值说明。
 */
function prefix(level: string, scope?: string): string {
  return `[${nowIso()}] [${level}]${scope ? ` [${scope}]` : ""}`;
}

export type Logger = {
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
};

/**
 * 创建一个带 scope 的前端 logger。
 * @param scope - 日志作用域（建议使用模块/组件名）
 * @returns Logger 实例
 */
/**
 * createLogger 方法说明。
 * @param scope? - 参数说明。
 * @returns 返回值说明。
 */
export function createLogger(scope?: string): Logger {
  const isDev = !!import.meta.env?.DEV;

  return {
    /**
     * debug method.
     * @param message - TODO.
     * @param meta - TODO.
     */
    debug(message, meta) {
      if (!isDev) return;
      console.debug(`${prefix("DEBUG", scope)} ${message}${formatMeta(meta)}`);
    },
    /**
     * info method.
     * @param message - TODO.
     * @param meta - TODO.
     */
    info(message, meta) {
      console.info(`${prefix("INFO", scope)} ${message}${formatMeta(meta)}`);
    },
    /**
     * warn method.
     * @param message - TODO.
     * @param meta - TODO.
     */
    warn(message, meta) {
      console.warn(`${prefix("WARN", scope)} ${message}${formatMeta(meta)}`);
    },
    /**
     * error method.
     * @param message - TODO.
     * @param meta - TODO.
     */
    error(message, meta) {
      console.error(`${prefix("ERROR", scope)} ${message}${formatMeta(meta)}`);
    },
  };
}
