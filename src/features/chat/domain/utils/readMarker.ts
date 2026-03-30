/**
 * @fileoverview chat 读标记比较工具（time + mid）。
 * @description chat｜domain/utils：统一 `lastReadTime + lastReadMessageId` 的比较语义。
 */

export function compareMessageIdForReadOrder(a: string, b: string): number {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  try {
    const x = BigInt(left);
    const y = BigInt(right);
    if (x === y) return 0;
    return x > y ? 1 : -1;
  } catch {
    if (left === right) return 0;
    return left > right ? 1 : -1;
  }
}

/**
 * 判断新的读标记是否应覆盖旧值。
 */
export function shouldAdvanceReadMarker(
  prevTimeMs: number,
  prevMid: string,
  nextTimeMs: number,
  nextMid: string,
): boolean {
  if (nextTimeMs > prevTimeMs) return true;
  if (nextTimeMs < prevTimeMs) return false;
  return compareMessageIdForReadOrder(nextMid, prevMid) >= 0;
}

/**
 * 判断消息是否处于当前读标记之后。
 */
export function isMessageAfterReadMarker(
  messageTimeMs: number,
  messageId: string,
  readTimeMs: number,
  readMid: string,
): boolean {
  if (messageTimeMs > readTimeMs) return true;
  if (messageTimeMs < readTimeMs) return false;
  return compareMessageIdForReadOrder(messageId, readMid) > 0;
}
