/**
 * @fileoverview 浮动菜单定位钳制｜纯函数：根据窗口边界计算菜单安全位置。
 * @description shared/ui：供右键菜单、下拉菜单等 fixed 定位浮层使用，
 * 保证菜单不会因窗口边界限制而被裁切。
 */

/** 菜单与窗口边缘的最小安全间距（像素）。 */
export const FLOATING_MENU_MARGIN = 8;

/** 钳制后的菜单位置与尺寸约束。 */
export interface ClampedMenuPlacement {
  /** 最终 left（px，相对视口）。 */
  left: number;
  /** 最终 top（px，相对视口）。 */
  top: number;
  /** 建议的最大高度（px），超出时菜单内部应可滚动。 */
  maxHeight: number;
  /** 建议的最大宽度（px）。 */
  maxWidth: number;
  /** 是否发生了垂直方向翻转（向上弹出）。 */
  flippedUp: boolean;
  /** 是否发生了水平方向翻转（向左弹出）。 */
  flippedLeft: boolean;
}

/**
 * 单轴钳制：优先在期望坐标处放置；空间不足时向反方向翻转；仍不足时贴边钳制。
 *
 * @param desired - 期望的起始坐标（左/上边缘）
 * @param size - 菜单在该轴上的尺寸
 * @param viewport - 视口在该轴上的长度
 * @param margin - 与窗口边缘的最小间距
 * @returns `[最终坐标, 是否翻转]`
 */
function clampAxis(desired: number, size: number, viewport: number, margin: number): [number, boolean] {
  const maxStart = viewport - size - margin;
  // 空间充足：原样放置。
  if (desired >= margin && desired <= maxStart) {
    return [desired, false];
  }
  // 反方向（翻转）放置：坐标为期望点减去菜单尺寸。
  const flipped = desired - size;
  if (flipped >= margin && flipped <= maxStart) {
    return [flipped, true];
  }
  // 两侧都不足（或期望坐标越界）：贴边钳制，保证完全可见。
  return [Math.max(margin, Math.min(desired, maxStart)), false];
}

/**
 * 计算菜单在视口内的安全位置。
 *
 * 规则：
 * 1. 默认在期望坐标右下方展开；
 * 2. 右侧/下方空间不足时翻转到左/上；
 * 3. 两端都不足时贴边钳制，并给出 max 尺寸让菜单内部滚动。
 *
 * @param desiredX - 期望左边缘 x（通常为鼠标 clientX 或锚点右边缘）
 * @param desiredY - 期望上边缘 y（通常为鼠标 clientY 或锚点下边缘）
 * @param menuWidth - 菜单实际渲染宽度（px）
 * @param menuHeight - 菜单实际渲染高度（px）
 * @param viewportW - 视口宽度（window.innerWidth）
 * @param viewportH - 视口高度（window.innerHeight）
 * @param margin - 与窗口边缘的最小间距，默认 8px
 * @returns 钳制后的位置与尺寸约束
 */
export function clampMenuPosition(
  desiredX: number,
  desiredY: number,
  menuWidth: number,
  menuHeight: number,
  viewportW: number,
  viewportH: number,
  margin: number = FLOATING_MENU_MARGIN,
): ClampedMenuPlacement {
  const [left, flippedLeft] = clampAxis(desiredX, menuWidth, viewportW, margin);
  const [top, flippedUp] = clampAxis(desiredY, menuHeight, viewportH, margin);
  return {
    left,
    top,
    maxHeight: Math.max(margin, viewportH - margin * 2),
    maxWidth: Math.max(margin, viewportW - margin * 2),
    flippedUp,
    flippedLeft,
  };
}
