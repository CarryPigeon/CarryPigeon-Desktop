/**
 * @fileoverview messageFormat.ts 文件职责说明。
 */
import type { Message } from "./messageTypes";

/**
 * resolveTimestamp 方法说明。
 * @param message - 参数说明。
 * @returns 返回值说明。
 */
export function resolveTimestamp(message: Message): number {
  const raw = (message as unknown as { timestamp?: unknown }).timestamp;

  if (typeof raw === "number") return raw;
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "string" && raw.length > 0) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * formatTimeLabel 方法说明。
 * @param timestampMs - 参数说明。
 * @returns 返回值说明。
 */
export function formatTimeLabel(timestampMs: number): string {
  if (!timestampMs) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestampMs));
  } catch {
    return "";
  }
}

/**
 * formatDayLabel 方法说明。
 * @param timestampMs - 参数说明。
 * @returns 返回值说明。
 */
export function formatDayLabel(timestampMs: number): string {
  if (!timestampMs) return "";
  try {
    const date = new Date(timestampMs);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      weekday: "short",
    }).format(date);
  } catch {
    return "";
  }
}

/**
 * dayKey 方法说明。
 * @param timestampMs - 参数说明。
 * @returns 返回值说明。
 */
export function dayKey(timestampMs: number): string {
  if (!timestampMs) return "";
  const d = new Date(timestampMs);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

