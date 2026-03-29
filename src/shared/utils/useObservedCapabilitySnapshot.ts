/**
 * @fileoverview useObservedCapabilitySnapshot.ts
 * @description
 * 在 Vue scope 内把 capability 的 snapshot/observe 协议桥接为本地 ref。
 */

import { onScopeDispose, ref, type Ref } from "vue";

type SnapshotReadable<T> = {
  getSnapshot(): T;
  observeSnapshot(observer: (snapshot: T) => void): () => void;
};

/**
 * 将 capability snapshot 协议桥接为本地 ref。
 *
 * @param readable - 支持 `getSnapshot/observeSnapshot` 的 capability。
 * @returns 随 capability 更新而同步变化的本地 ref。
 */
export function useObservedCapabilitySnapshot<T>(readable: SnapshotReadable<T>): Ref<T> {
  const state = ref(readable.getSnapshot()) as Ref<T>;
  const stop = readable.observeSnapshot((snapshot) => {
    state.value = snapshot;
  });
  onScopeDispose(stop);
  return state;
}
