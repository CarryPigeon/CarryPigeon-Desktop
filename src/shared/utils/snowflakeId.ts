/**
 * @fileoverview 十进制雪花 ID 校验。
 * @description 服务端路径/查询里的账号与频道 ID 必须是正十进制数字字符串。
 */

/**
 * 判断字符串是否可作为服务端雪花 ID。
 */
export function isSnowflakeId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(String(value ?? "").trim());
}

/**
 * 把逗号分隔输入拆成合法雪花 ID 列表；含非法段时返回空数组。
 */
export function parseSnowflakeIdList(value: string): string[] {
  const parts = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];
  if (parts.some((part) => !isSnowflakeId(part))) return [];
  return parts;
}
