/**
 * @fileoverview useFocusTrap.ts
 * @description A11y focus trap composable — 弹窗/抽屉打开时锁定焦点，关闭后恢复。
 *
 * 用法：
 * ```ts
 * const { trapFocus, releaseFocus } = useFocusTrap(containerRef);
 * // 弹窗打开时调用 trapFocus()
 * // 弹窗关闭时调用 releaseFocus()
 * ```
 */

import { onBeforeUnmount, type Ref } from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/**
 * 获取容器内所有可聚焦元素。
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
}

/**
 * focus trap composable。
 *
 * @param containerRef — 弹窗/抽屉容器元素的 template ref。
 */
export function useFocusTrap(containerRef: Ref<HTMLElement | null | undefined>) {
  let previousActiveElement: Element | null = null;

  /**
   * 键盘事件处理：Tab/Shift+Tab 在容器内循环焦点。
   */
  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== "Tab") return;
    const container = containerRef.value;
    if (!container) return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /**
   * 激活焦点捕获。
   *
   * 保存当前焦点元素，聚焦到容器内第一个可聚焦元素。
   */
  function trapFocus(): void {
    previousActiveElement = document.activeElement;
    document.addEventListener("keydown", onKeydown);

    // 延迟聚焦以确保 DOM 已就绪
    requestAnimationFrame(() => {
      const container = containerRef.value;
      if (!container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    });
  }

  /**
   * 释放焦点捕获并恢复到之前的焦点元素。
   */
  function releaseFocus(): void {
    document.removeEventListener("keydown", onKeydown);
    if (previousActiveElement instanceof HTMLElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
  }

  onBeforeUnmount(() => {
    releaseFocus();
  });

  return { trapFocus, releaseFocus };
}
