/**
 * @fileoverview createWatchedSnapshotObserver.ts
 * @description
 * 为基于 Vue 响应式状态的快照读取函数生成统一的 `observeSnapshot()` 实现。
 *
 * 适用场景：
 * - capability 的内部实现仍依赖 Vue `computed/ref`；
 * - 但希望把 `watch()` 从 feature `api.ts` 中移出，避免公开装配层直接依赖 Vue。
 *
 * 监听注册在独立 effect scope 中，避免模块级 `observeSnapshot()` 被首个
 * 导入它的页面卸载时一并停止。
 */

import { watchInDetachedScope } from "@/shared/utils/watchInDetachedScope";

/**
 * 基于快照读取函数创建立即推送型观察器。
 *
 * @param readSnapshot - 当前快照读取函数。
 * @returns 符合 capability 协议的观察函数。
 */
export function createWatchedSnapshotObserver<TSnapshot>(
  readSnapshot: () => TSnapshot,
): (observer: (snapshot: TSnapshot) => void) => () => void {
  return (observer: (snapshot: TSnapshot) => void): (() => void) =>
    watchInDetachedScope(readSnapshot, observer, { immediate: true });
}
