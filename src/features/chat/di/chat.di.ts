/**
 * @fileoverview chat.di.ts
 * @description chat｜依赖组装（DI）：chat.di。
 *
 * 说明：
 * - 这是 chat 对展示层暴露的稳定 DI 入口；
 * - 页面/组件只应通过这里拿子域 runtime store，而不是直接访问 composition root；
 * - `ports / usecases` 属于内部装配细节，不从这里泄漏。
 */
export {
  getRoomSessionStore,
  getMessageFlowStore,
  getRoomGovernanceStore,
} from "./chatRuntime";
