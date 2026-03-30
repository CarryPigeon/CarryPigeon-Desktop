/**
 * @fileoverview quickSwitcherStore.ts
 * @description chat｜展示层状态（store）：quickSwitcherStore。
 */

import { ref } from "vue";

/**
 * Whether the quick switcher modal is currently open.
 *
 * @constant
 */
export const quickSwitcherOpen = ref(false);

/**
 * Current query string typed into the quick switcher input.
 *
 * @constant
 */
export const quickSwitcherQuery = ref("");

/**
 * Keyboard focus index within the filtered result list.
 *
 * @constant
 */
export const quickSwitcherActiveIndex = ref(0);

/**
 * Open the quick switcher and reset query + selection.
 *
 * UX expectation:
 * - Opening always starts from a clean state (empty query, first item active).
 */
export function openQuickSwitcher(): void {
  quickSwitcherOpen.value = true;
  quickSwitcherQuery.value = "";
  quickSwitcherActiveIndex.value = 0;
}

/**
 * Close the quick switcher modal.
 */
export function closeQuickSwitcher(): void {
  quickSwitcherOpen.value = false;
}

/**
 * Move the active index by `delta` (supports wrap-around).
 *
 * @param delta - Usually `+1` (down) or `-1` (up).
 * @param max - The length of the current result list.
 */
export function bumpActiveIndex(delta: number, max: number): void {
  const n = Math.max(0, Math.trunc(max));
  if (n <= 0) {
    quickSwitcherActiveIndex.value = 0;
    return;
  }
  const next = (quickSwitcherActiveIndex.value + delta + n) % n;
  quickSwitcherActiveIndex.value = next;
}
