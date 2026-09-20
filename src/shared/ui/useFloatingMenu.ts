/**
 * @fileoverview 浮动菜单定位组合式｜打开后测量真实尺寸并按视口钳制。
 * @description shared/ui：供右键菜单、下拉菜单等 fixed 定位浮层使用，
 * 确保菜单不会因窗口大小限制而被裁切（空间不足时自动翻转/贴边/内部滚动）。
 */

import { nextTick, onBeforeUnmount, ref, type CSSProperties } from "vue";
import { clampMenuPosition, FLOATING_MENU_MARGIN } from "./floatingMenu";
/**
 * 浮动菜单定位组合式。
 *
 * 用法：
 * - 模板中给菜单根元素绑定 `ref="menuEl"` 与 `:style="menuStyle"`（菜单需 fixed 定位并已 Teleport 到 body）；
 * - 通过 `menuStyle` 控制位置；打开菜单时更新期望坐标，组件内部会在渲染后测量
 *   菜单真实尺寸并钳制到视口内。
 *
 * @param opts.x - 响应式期望左边缘 x（鼠标 clientX 或锚点右边缘）
 * @param opts.y - 响应式期望上边缘 y（鼠标 clientY 或锚点下边缘）
 * @param opts.right - 可选：以右边缘对齐目标（如触发按钮右边缘），优先于 `x`
 * @param opts.open - 响应式打开状态（用于 resize 时判断是否需要重算）
 * @param opts.margin - 与窗口边缘的最小间距，默认 8px
 * @returns 菜单元素 ref 与响应式内联样式
 */
export function useFloatingMenu(opts: {
  x: () => number;
  y: () => number;
  open: () => boolean;
  right?: () => number;
  margin?: number;
}) {
  const menuEl = ref<HTMLElement | null>(null);
  // 初始隐藏，避免在钳制完成前按原始坐标闪现一帧被裁切的菜单。
  const menuStyle = ref<CSSProperties>({ visibility: "hidden" });
  let rafId = 0;

  /**
   * 测量菜单并计算钳制后的定位样式。
   *
   * @returns 无返回值。
   */
  function applyPlacement(): void {
    const el = menuEl.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = opts.margin ?? FLOATING_MENU_MARGIN;
    // 右对齐目标优先：期望左边缘 = 目标右边缘 - 菜单宽度。
    const desiredX = opts.right ? opts.right() - rect.width : opts.x();
    const placement = clampMenuPosition(
      desiredX,
      opts.y(),
      rect.width,
      rect.height,
      window.innerWidth,
      window.innerHeight,
      margin,
    );
    menuStyle.value = {
      visibility: "visible",
      left: `${placement.left}px`,
      top: `${placement.top}px`,
      maxHeight: `${placement.maxHeight}px`,
      maxWidth: `${placement.maxWidth}px`,
      overflowY: "auto",
      overscrollBehavior: "contain",
    };
  }

  /**
   * 打开菜单后调用：等待 DOM 渲染完成再测量定位。
   *
   * @returns 无返回值。
   */
  function schedulePlacement(): void {
    void nextTick(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyPlacement);
    });
  }

  /**
   * 窗口尺寸变化时重新钳制（仅当菜单仍处于打开状态）。
   */
  function handleResize(): void {
    if (!opts.open()) return;
    applyPlacement();
  }

  /**
   * 模板函数式 ref 绑定：`:ref="setMenuEl"`。
   *
   * @param el - Vue 传入的元素或组件实例
   * @returns 无返回值。
   */
  function setMenuEl(el: unknown): void {
    menuEl.value = el instanceof HTMLElement ? el : null;
  }

  window.addEventListener("resize", handleResize);

  onBeforeUnmount(() => {
    window.removeEventListener("resize", handleResize);
    cancelAnimationFrame(rafId);
  });

  return { menuEl, setMenuEl, menuStyle, schedulePlacement, applyPlacement };
}
