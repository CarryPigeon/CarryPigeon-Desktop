/**
 * @fileoverview wireMapperUtils.ts
 * @description 共享 wire <-> domain 映射工具函数。
 */

/**
 * 将任意值转换为修剪后的字符串。
 */
export function asTrimmedString(value: unknown): string {
  return String(value ?? "").trim();
}

/**
 * 将任意值转换为可选的修剪后字符串（空字符串返回 undefined）。
 */
export function asOptionalString(value: unknown): string | undefined {
  const next = asTrimmedString(value);
  return next || undefined;
}

/**
 * 将任意值转换为安全的数字。
 */
export function asSafeNumber(value: unknown): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? Math.trunc(next) : 0;
}

/**
 * 将任意值转换为可选的安全数字。
 */
export function asOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? Math.trunc(next) : undefined;
}

/**
 * 将任意值转换为布尔值。
 */
export function asSafeBoolean(value: unknown): boolean {
  return Boolean(value);
}
