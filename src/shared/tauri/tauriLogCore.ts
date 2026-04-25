/**
 * @fileoverview Tauri 日志桥接的纯函数核心（无平台依赖）。
 */
export type LogMeta = Record<string, unknown>;

const SENSITIVE_FIELD_RE = /(?:token|authorization|password|secret|key|code|verification)/i;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const KEYED_VALUE_RE = /(["']?(?:token|authorization|password|secret|key|code|verification)["']?\s*[:=]\s*)(["']?)([^"'{}\]\s,;]+)\2/gi;

function isSensitiveFieldKey(key: string): boolean {
  return SENSITIVE_FIELD_RE.test(key);
}

function redactSensitiveText(text: string): string {
  return text.replace(BEARER_RE, "[REDACTED]").replace(KEYED_VALUE_RE, "$1$2[REDACTED]$2");
}

function redactValue(value: unknown, key?: string): unknown {
  if (key && isSensitiveFieldKey(key)) {
    return "[REDACTED]";
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [entryKey, redactValue(entryValue, entryKey)] as const);
    return Object.fromEntries(entries);
  }

  return value;
}

/**
 * 将结构化元信息中的敏感值统一替换为 `[REDACTED]`。
 */
export function redactLogMeta(meta?: LogMeta): LogMeta | undefined {
  if (!meta) return undefined;
  return redactValue(meta) as LogMeta;
}

/**
 * 将任意 message 归一化为 `Action: <snake_case>`。
 */
export function normalizeActionMessage(message: string): string {
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

function formatMeta(meta?: LogMeta): string {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return " [meta_unserializable]";
  }
}

/**
 * 组合规范化动作消息与已经脱敏后的结构化元信息。
 */
export function buildMessage(message: string, meta?: LogMeta): string {
  return `${normalizeActionMessage(message)}${formatMeta(redactLogMeta(meta))}`;
}
