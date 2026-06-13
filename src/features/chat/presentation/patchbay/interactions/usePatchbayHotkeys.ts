/**
 * @fileoverview chat｜presentation composable：Patchbay 主窗口快捷键与浮层收拢。
 * @description 统一处理页面级浮层关闭与 Cmd/Ctrl 热键。
 * 配置式快捷键注册，支持新增扩展。
 */

import type { ComputedRef, Ref } from "vue";

type RefLike<T> = Ref<T> | ComputedRef<T>;

/**
 * 快捷键绑定定义。
 */
export type ShortcutBinding = {
  /** 按键名称（e.key 的小写形式，如 'k'、'escape'）。 */
  key: string;
  /** 是否需要 Meta（Cmd/Ctrl）组合。 */
  meta?: boolean;
  /** 是否需要 Alt 组合。 */
  alt?: boolean;
  /** 是否需要 Shift 组合。 */
  shift?: boolean;
  /** 按键触发时的回调。 */
  action: () => void;
    /** 快捷键描述文案（供帮助面板使用）。 */
  description: string;
  /** 分组：navigation（导航）| actions（操作）| general（通用）。 */
  category?: "navigation" | "actions" | "general";
};

/**
 * Patchbay 主窗口快捷键编排依赖。
 */
export type UsePatchbayHotkeysDeps = {
  quickSwitcherOpen: RefLike<boolean>;
  menuOpen: RefLike<boolean>;
  showChannelMenu: RefLike<boolean>;
  showCreateChatMenu: RefLike<boolean>;
  showCreateChannel: RefLike<boolean>;
  showCreateFriendPrivateChat: RefLike<boolean>;
  showDeleteChannel: RefLike<boolean>;
  closeQuickSwitcher(): void;
  openQuickSwitcher(): void;
  closeMenu(): void;
  closeChannelMenu(): void;
  closeCreateChatMenu(): void;
  setShowCreateChannel(visible: boolean): void;
  setShowCreateFriendPrivateChat(visible: boolean): void;
  setShowDeleteChannel(visible: boolean): void;
  goPlugins(): void;
  openSettings(): void;
  // --- 新增可选依赖 ---
  openSearchPanel?(): void;
  openShortcutHelp?(): void;
  closeShortcutHelp?(): void;
  shortcutHelpOpen?: RefLike<boolean>;
  previousChannel?(): void;
  nextChannel?(): void;
};

/**
 * Patchbay 主窗口按键与浮层行为编排。
 */
export function usePatchbayHotkeys(deps: UsePatchbayHotkeysDeps) {
  function closeTransientOverlays(): void {
    if (deps.quickSwitcherOpen.value) deps.closeQuickSwitcher();
    if (deps.menuOpen.value) deps.closeMenu();
    if (deps.showChannelMenu.value) deps.closeChannelMenu();
    if (deps.showCreateChatMenu.value) deps.closeCreateChatMenu();
    if (deps.showCreateChannel.value) deps.setShowCreateChannel(false);
    if (deps.showCreateFriendPrivateChat.value) deps.setShowCreateFriendPrivateChat(false);
    if (deps.showDeleteChannel.value) deps.setShowDeleteChannel(false);
  }

  /**
   * 快捷键绑定配置表。
   * 按语义分组：通用关闭 / 导航 / 操作。
   */
  const bindings: ShortcutBinding[] = [
    // --- 通用（general） ---
    {
      key: "escape",
      action: () => {
        // 如果快捷键帮助面板打开，优先关闭它
        if (deps.shortcutHelpOpen?.value) {
          deps.closeShortcutHelp?.();
          return;
        }
        closeTransientOverlays();
      },
      description: "shortcut_close",
      category: "general",
    },
    // --- 导航（navigation） ---
    {
      key: "k",
      meta: true,
      action: () => deps.openQuickSwitcher(),
      description: "shortcut_quick_switcher",
      category: "navigation",
    },
    {
      key: "f",
      meta: true,
      action: () => deps.openSearchPanel?.(),
      description: "shortcut_search",
      category: "navigation",
    },
    {
      key: "ArrowUp",
      alt: true,
      action: () => deps.previousChannel?.(),
      description: "shortcut_prev_channel",
      category: "navigation",
    },
    {
      key: "ArrowDown",
      alt: true,
      action: () => deps.nextChannel?.(),
      description: "shortcut_next_channel",
      category: "navigation",
    },
    // --- 操作（actions） ---
    {
      key: "p",
      meta: true,
      action: () => deps.goPlugins(),
      description: "shortcut_plugins",
      category: "actions",
    },
    {
      key: ",",
      meta: true,
      action: () => deps.openSettings(),
      description: "shortcut_settings",
      category: "actions",
    },
    {
      key: "/",
      meta: true,
      action: () => deps.openShortcutHelp?.(),
      description: "shortcut_help",
      category: "actions",
    },
  ];

  function onKeydown(e: KeyboardEvent): void {
    const key = e.key.toLowerCase();
    const meta = e.metaKey || e.ctrlKey;
    const alt = e.altKey;
    const shift = e.shiftKey;

    for (const binding of bindings) {
      const matchKey = binding.key.toLowerCase() === key;
      const matchMeta = binding.meta === undefined || binding.meta === meta;
      const matchAlt = binding.alt === undefined || binding.alt === alt;
      const matchShift = binding.shift === undefined || binding.shift === shift;

      if (matchKey && matchMeta && matchAlt && matchShift) {
        // Escape 不 preventDefault，允许浏览器处理原生行为（退出全屏等）
        if (e.key !== "Escape") {
          e.preventDefault();
        }
        binding.action();
        return;
      }
    }
  }

  return {
    closeTransientOverlays,
    onKeydown,
    bindings,
  };
}
