/**
 * @fileoverview chat｜presentation composable：Patchbay 主窗口快捷键与浮层收拢。
 * @description 统一处理页面级浮层关闭与 Cmd/Ctrl 热键。
 */

import type { ComputedRef, Ref } from "vue";

type RefLike<T> = Ref<T> | ComputedRef<T>;

/**
 * Patchbay 主窗口快捷键编排依赖。
 */
export type UsePatchbayHotkeysDeps = {
  quickSwitcherOpen: RefLike<boolean>;
  menuOpen: RefLike<boolean>;
  showChannelMenu: RefLike<boolean>;
  showCreateChannel: RefLike<boolean>;
  showDeleteChannel: RefLike<boolean>;
  closeQuickSwitcher(): void;
  openQuickSwitcher(): void;
  closeMenu(): void;
  closeChannelMenu(): void;
  setShowCreateChannel(visible: boolean): void;
  setShowDeleteChannel(visible: boolean): void;
  goPlugins(): void;
  openSettings(): void;
};

/**
 * Patchbay 主窗口按键与浮层行为编排。
 */
export function usePatchbayHotkeys(deps: UsePatchbayHotkeysDeps) {
  function closeTransientOverlays(): void {
    if (deps.quickSwitcherOpen.value) deps.closeQuickSwitcher();
    if (deps.menuOpen.value) deps.closeMenu();
    if (deps.showChannelMenu.value) deps.closeChannelMenu();
    if (deps.showCreateChannel.value) deps.setShowCreateChannel(false);
    if (deps.showDeleteChannel.value) deps.setShowDeleteChannel(false);
  }

  function onKeydown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const meta = e.metaKey || e.ctrlKey;

    if (e.key === "Escape") {
      closeTransientOverlays();
      return;
    }

    if (meta && key === "k") {
      e.preventDefault();
      deps.openQuickSwitcher();
      return;
    }

    if (meta && key === "p") {
      e.preventDefault();
      deps.goPlugins();
      return;
    }

    if (meta && key === ",") {
      e.preventDefault();
      deps.openSettings();
    }
  }

  return {
    closeTransientOverlays,
    onKeydown,
  };
}
