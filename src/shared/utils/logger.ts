/**
 * @fileoverview 前端日志工具（console 统一出口）。
 * @description 业务代码不应直接使用 `console.*`，而应使用 `createLogger(scope)` 输出结构化日志。
 */
type LogMeta = Record<string, unknown>;

/**
 * 前端日志工具（基于 console）。
 *
 * 约定：
 * - 每个模块/组件优先使用 `createLogger("ScopeName")` 创建带 scope 的 logger。
 * - 优先传入结构化 `meta`，避免字符串拼接。
 * - `debug()` 仅在 DEV 环境启用；`info/warn/error` 始终启用。
 * - 除本模块外，禁止在业务代码中直接使用 `console.*`。
 */
/**
 * 将结构化元信息渲染为可安全输出到 console 的字符串。
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
 * @returns 用于日志前缀的 ISO 时间字符串。
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * 构造日志前缀字符串。
 *
 * 格式：`[ISO] [LEVEL] [scope]`
 *
 * @param level - 日志级别标签。
 * @param scope - 可选 scope（通常为模块/组件名）。
 * @returns 前缀字符串。
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
 * 创建带 scope 的前端 logger。
 *
 * 设计目标：
 * - 统一 console 输出格式与元信息处理。
 * - 鼓励结构化日志（`meta` 对象），避免字符串拼接。
 * - `debug` 仅在 DEV 启用，减少生产环境噪音。
 *
 * @param scope - 可选 scope 标签（通常为模块/组件名）。
 * @returns Logger 实例。
 */
export function createLogger(scope?: string): Logger {
  const isDev = !!import.meta.env?.DEV;

  return {
    debug(message, meta) {
      if (!isDev) return;
      console.debug(`${prefix("DEBUG", scope)} ${message}${formatMeta(meta)}`);
    },
    info(message, meta) {
      console.info(`${prefix("INFO", scope)} ${message}${formatMeta(meta)}`);
    },
    warn(message, meta) {
      console.warn(`${prefix("WARN", scope)} ${message}${formatMeta(meta)}`);
    },
    error(message, meta) {
      console.error(`${prefix("ERROR", scope)} ${message}${formatMeta(meta)}`);
    },
  };
}
