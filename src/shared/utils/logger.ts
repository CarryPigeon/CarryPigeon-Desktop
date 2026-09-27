/**
 * @fileoverview 前端日志工具（console 统一出口）。
 * @description 业务代码不应直接使用 `console.*`，而应使用 `createLogger(scope)` 输出结构化日志。
 */
import { isTauriRuntimeAvailable, tauriLog } from "@/shared/tauri";

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
 * 将任意 message 归一化为 `Action: <snake_case>`。
 *
 * @param message - 原始日志消息。
 * @returns 归一化后的动作消息。
 */
function normalizeActionMessage(message: string): string {
  const trimmed = message.trim();
  const noPrefix = trimmed.replace(/^Action:\s*/i, "");
  const withWordBoundary = noPrefix.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
  const snake = withWordBoundary
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .toLowerCase();
  return `Action: ${snake || "unknown_action"}`;
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

/**
 * 前端 logger 接口（带 `debug/info/warn/error` 四级）。
 */
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
 * - 强制动作日志格式：`Action: <snake_case>`。
 * - `debug` 仅在 DEV 启用，减少生产环境噪音。
 *
 * @param scope - 可选 scope 标签（通常为模块/组件名）。
 * @returns Logger 实例。
 */
export function createLogger(scope?: string): Logger {
  const isDev = !!import.meta.env?.DEV;

  // release 构建没有 devtools 时 console 不可见：将 warn/error 尽力转发到 Rust 文件日志，
  // 便于对发布包进行排障（转发失败会被 tauriLog 吞掉，不影响 UI）。
  //
  // 注意：check-log-standards 按行校验 `Action: <domain>_...`，转发语句自身也必须带合法的
  // Action；原始动作名去掉 `Action: ` 前缀后放进正文，避免文件日志里出现两段 `Action:`。
  const forwardToTauri = (level: "warn" | "error", normalized: string, formatted: string): void => {
    if (!isTauriRuntimeAvailable()) return;
    const body = `${normalized.replace(/^Action:\s*/i, "")}${formatted}`;
    const scopeTag = scope ?? "-";
    if (level === "warn") tauriLog.warn(`Action: api_log_forwarded_warn scope=${scopeTag} ${body}`);
    else tauriLog.error(`Action: api_log_forwarded_error scope=${scopeTag} ${body}`);
  };

  return {
    debug(message, meta) {
      if (!isDev) return;
      const normalized = normalizeActionMessage(message);
      console.debug(`${prefix("DEBUG", scope)} ${normalized}${formatMeta(meta)}`);
    },
    info(message, meta) {
      const normalized = normalizeActionMessage(message);
      console.info(`${prefix("INFO", scope)} ${normalized}${formatMeta(meta)}`);
    },
    warn(message, meta) {
      const normalized = normalizeActionMessage(message);
      const formatted = formatMeta(meta);
      console.warn(`${prefix("WARN", scope)} ${normalized}${formatted}`);
      forwardToTauri("warn", normalized, formatted);
    },
    error(message, meta) {
      const normalized = normalizeActionMessage(message);
      const formatted = formatMeta(meta);
      console.error(`${prefix("ERROR", scope)} ${normalized}${formatted}`);
      forwardToTauri("error", normalized, formatted);
    },
  };
}
