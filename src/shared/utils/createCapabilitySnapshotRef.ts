/**
 * @fileoverview createCapabilitySnapshotRef.ts
 * @description
 * 在模块级或应用级生命周期中，把 capability 的 snapshot/observe 协议桥接为长生命周期 ref。
 *
 * 与 `useObservedCapabilitySnapshot()` 的区别：
 * - 本 helper 不绑定 Vue 组件 scope；
 * - 适用于 integration 单例、feature 共享状态桥接；
 * - 调用方应确保该 ref 的生命周期与模块或应用生命周期一致。
 */

import { ref, type Ref } from "vue";

type SnapshotReadable<T> = {
  getSnapshot(): T;
  observeSnapshot(observer: (snapshot: T) => void): () => void;
};

/**
 * 将 capability 快照桥接为长生命周期 ref。
 *
 * @param readable - 支持 `getSnapshot/observeSnapshot` 的 capability。
 * @returns 与 capability 保持同步的 ref。
 */
export function createCapabilitySnapshotRef<T>(readable: SnapshotReadable<T>): Ref<T> {
  const state = ref(readable.getSnapshot()) as Ref<T>;
  readable.observeSnapshot((snapshot) => {
    state.value = snapshot;
  });
  return state;
}
