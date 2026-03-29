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
 * 使用建议：
 * - 页面渲染、page model、rail model 这类持续消费的 UI 状态优先使用本 helper；
 * - 只在用户动作里做一次性读取时，继续直接调用 capability 的查询方法即可。
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
