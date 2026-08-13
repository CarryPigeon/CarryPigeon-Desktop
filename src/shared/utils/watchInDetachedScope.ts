/**
 * @fileoverview 在独立 effect scope 中注册 watch。
 * @description
 * Vue 的 `watch()` 会挂到当前组件 effect scope。
 * 若模块级单例在某个页面 setup 期间首次求值，该 watch 会随页面卸载一起停止，
 * 导致跨路由后快照/切服监听失效。独立 scope 使监听与页面生命周期解耦。
 */

import { effectScope, watch, type WatchCallback, type WatchOptions, type WatchSource, type WatchStopHandle } from "vue";

/**
 * 注册不绑定当前组件的 watch，并返回停止函数。
 *
 * @param source - 与 `watch()` 相同的数据源。
 * @param callback - 与 `watch()` 相同的回调。
 * @param options - 与 `watch()` 相同的选项。
 * @returns 停止监听并释放独立 scope 的函数。
 */
export function watchInDetachedScope<T>(
  source: WatchSource<T>,
  callback: WatchCallback<T>,
  options?: WatchOptions,
): WatchStopHandle {
  const scope = effectScope(true);
  let stopInner: WatchStopHandle = () => {};
  scope.run(() => {
    stopInner = watch(source, callback, options);
  });
  return () => {
    stopInner();
    scope.stop();
  };
}
