/**
 * @fileoverview WS `event_id` 比较工具。
 * @description
 * 协议约定：服务端推送事件必须携带单调递增 `event_id`（推荐 Snowflake，十进制字符串）。
 *
 * 客户端需要把 `event_id` 当作“不透明但可比较”的游标，用于：
 * - 断点续传（resume）：`auth.data.resume.last_event_id`
 * - 去重：忽略重复事件
 * - 乱序保护：忽略 `event_id` 小于等于已处理游标的事件
 */

/**
 * 判断字符串是否“看起来像”十进制 Snowflake（只包含数字）。
 *
 * @param value - 候选字符串。
 * @returns 是否为非空十进制数字串。
 */
export function isLikelySnowflakeDecimal(value: string): boolean {
  const s = String(value ?? "").trim();
  if (!s) return false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

/**
 * 比较两个 `event_id` 的先后顺序（优先按 Snowflake 十进制 BigInt 比较）。
 *
 * @param a - event_id A。
 * @param b - event_id B。
 * @returns 比较结果：-1（a<b）、0（相等）、1（a>b）。
 */
export function compareEventId(a: string, b: string): number {
  const x = String(a ?? "").trim();
  const y = String(b ?? "").trim();
  if (!x && !y) return 0;
  if (!x) return -1;
  if (!y) return 1;
  if (x === y) return 0;

  if (isLikelySnowflakeDecimal(x) && isLikelySnowflakeDecimal(y)) {
    try {
      const bx = BigInt(x);
      const by = BigInt(y);
      return bx < by ? -1 : 1;
    } catch {
      // BigInt 解析失败时降级为字符串比较（尽量保持稳定性）。
    }
  }

  return x.localeCompare(y);
}
