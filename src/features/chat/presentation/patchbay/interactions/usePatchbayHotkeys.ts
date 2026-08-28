/**
 * @fileoverview chat｜presentation composable：Patchbay 主窗口 Esc 收拢。
 * @description 统一处理页面级浮层关闭。组合式快捷键已移除，仅保留全局 Esc 关闭浮层。
 */

import type { ComputedRef, Ref } from "vue";

type RefLike<T> = Ref<T> | ComputedRef<T>;

/**
 * Patchbay 主窗口 Esc 行为编排依赖。
 */
export type UsePatchbayHotkeysDeps = {
  menuOpen: RefLike<boolean>;
  showChannelMenu: RefLike<boolean>;
  showCreateChannel: RefLike<boolean>;
  showDeleteChannel: RefLike<boolean>;
  closeMenu(): void;
  closeChannelMenu(): void;
  setShowCreateChannel(visible: boolean): void;
  setShowDeleteChannel(visible: boolean): void;
};

/**
 * Patchbay 主窗口按键与浮层行为编排。
 */
export function usePatchbayHotkeys(deps: UsePatchbayHotkeysDeps) {
  function closeTransientOverlays(): void {
    if (deps.menuOpen.value) deps.closeMenu();
    if (deps.showChannelMenu.value) deps.closeChannelMenu();
    if (deps.showCreateChannel.value) deps.setShowCreateChannel(false);
    if (deps.showDeleteChannel.value) deps.setShowDeleteChannel(false);
  }

  /**
   * 全局 keydown：仅处理 Escape 关闭浮层。
   * Escape 不 preventDefault，允许浏览器处理原生行为（退出全屏等）。
   */
  function onKeydown(e: KeyboardEvent): void {
    if (e.key !== "Escape") return;
    closeTransientOverlays();
  }

  return {
    closeTransientOverlays,
    onKeydown,
  };
}
