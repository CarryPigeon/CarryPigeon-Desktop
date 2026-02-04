/**
 * @fileoverview mock 延迟工具（sleep.ts）。
 */

/**
 * 延迟执行指定时长。
 *
 * 主要用于 mock service 模拟网络延迟，以便本地预览 UI 状态（loading/progress/retry）。
 *
 * @param ms - 延迟毫秒数；非有限值按 `0` 处理。
 * @returns 在延迟结束后 resolve 的 Promise。
 */
export function sleep(ms: number): Promise<void> {
  const delay = Number.isFinite(ms) ? Math.max(0, Math.trunc(ms)) : 0;
  return new Promise((resolve) => setTimeout(resolve, delay));
}
