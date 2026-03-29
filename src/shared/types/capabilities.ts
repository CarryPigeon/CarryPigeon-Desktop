/**
 * @fileoverview capability 公共类型。
 * @description
 * 收敛跨 feature 可复用的 capability 协议类型，避免各 feature 重复定义相同只读状态契约。
 */

/**
 * 可读 capability 的统一状态协议。
 *
 * 约定：
 * - `getSnapshot()` 返回 plain data；
 * - `observeSnapshot()` 注册后立即推送一次当前快照；
 * - 返回值用于取消观察。
 *
 * 使用约束：
 * - 会驱动页面渲染、长生命周期 composable 或跨多个 computed 持续消费的状态，优先走
 *   `observeSnapshot()`；
 * - `getSnapshot()` 只用于命令执行时的一次性读取、前置校验或桥接初始化，不应作为
 *   长期响应式渲染的隐式数据源。
 */
export type ReadableCapability<TSnapshot> = {
  getSnapshot(): TSnapshot;
  observeSnapshot(observer: (snapshot: TSnapshot) => void): () => void;
};
