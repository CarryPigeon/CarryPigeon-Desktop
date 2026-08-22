/**
 * @fileoverview chat 共享用户 ID 归一化工具。
 * @description
 * 消息 wire 层与账户会话层的用户 id 可能带 `u:` / `U:` 前缀或大小写差异，
 * 用于"是否本人消息（data-mine）"等比较前统一形态，避免同一个人被判成两个人。
 */

/**
 * 归一化用户 id：trim + 去掉 `u:` 前缀 + 转小写。
 *
 * @param raw - 任意来源的用户 id 字符串。
 * @returns 归一化后的 id；空串原样返回空串。
 */
export function normalizeUserId(raw: string): string {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return "";
  const withoutPrefix = trimmed.replace(/^u:/i, "");
  return withoutPrefix.toLowerCase();
}

/**
 * 判断两个用户 id 是否指向同一用户（归一化后比较）。
 *
 * @param a - 用户 id A。
 * @param b - 用户 id B。
 * @returns 归一化后相等且非空时为 `true`。
 */
export function isSameUserId(a: string, b: string): boolean {
  const na = normalizeUserId(a);
  const nb = normalizeUserId(b);
  if (!na || !nb) return false;
  return na === nb;
}
