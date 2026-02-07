/**
 * @fileoverview mockModeSelector.ts
 * @description 运行时 mock 模式选择工具。
 */

import { IS_MOCK_ENABLED, IS_STORE_MOCK, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";

/**
 * 按 mock 模式选择实现（off/store/protocol）。
 *
 * @typeParam T - 目标实现类型。
 */
export type MockModeSelection<T> = {
  off: () => T;
  store: () => T;
  protocol?: () => T;
};

/**
 * 根据运行时 mock 模式返回对应实现。
 *
 * 规则：
 * - protocol 优先于 store；
 * - protocol 未提供时回退到 off。
 *
 * @typeParam T - 目标实现类型。
 * @param selection - 各模式对应实现。
 * @returns 当前模式对应的实现。
 */
export function selectByMockMode<T>(selection: MockModeSelection<T>): T {
  if (USE_MOCK_TRANSPORT) return (selection.protocol ?? selection.off)();
  if (IS_STORE_MOCK) return selection.store();
  return selection.off();
}

/**
 * 按“是否启用任意 mock”选择实现。
 *
 * @typeParam T - 目标实现类型。
 * @param mock - mock 模式实现。
 * @param live - 非 mock 模式实现。
 * @returns 对应实现。
 */
export function selectByMockEnabled<T>(mock: () => T, live: () => T): T {
  return IS_MOCK_ENABLED ? mock() : live();
}
