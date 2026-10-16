<script setup lang="ts">
/**
 * @fileoverview ContextMenuHost.vue
 * @description shared/ui｜全局右键菜单宿主（单例）：屏蔽 WebView2 原生菜单，
 * 并为输入区（编辑菜单）与文本选区（复制/全选）提供应用风格菜单。
 *
 * 说明：
 * - 监听挂在 `document` 冒泡阶段：默认动作在派发结束后发生，因此冒泡阶段 `preventDefault()`
 *   即可屏蔽原生菜单，同时能准确读到 `defaultPrevented`（既有消息/频道/文件菜单已接管）；
 * - 组件在 `App.vue` 中挂载一次，主窗口与子窗口共用同一套菜单。
 */

import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import ContextMenuSurface from "./ContextMenuSurface.vue";
import ContextMenuItem from "./ContextMenuItem.vue";
import {
  resolveContextMenuEvent,
  runContextMenuAction,
  type ContextMenuActionKey,
  type ContextMenuRequest,
} from "@/shared/utils/contextMenu";
import {
  canReadClipboardText,
  copyTextToClipboard,
  readClipboardText,
} from "@/shared/utils/clipboard";
import { toast } from "@/shared/utils/toast";

defineOptions({ name: "ContextMenuHost" });

const { t } = useI18n();

/** 菜单是否打开。 */
const menuOpen = ref(false);
/** 菜单期望左边缘 x。 */
const menuX = ref(0);
/** 菜单期望上边缘 y。 */
const menuY = ref(0);
/** 当前菜单请求（动作执行需要目标元素与选区）。 */
const request = ref<ContextMenuRequest | null>(null);

/** 当前菜单条目。 */
const items = computed(() => request.value?.items ?? []);

/**
 * 关闭菜单（保留 request，供动作执行读取）。
 *
 * @returns 无返回值。
 */
function closeMenu(): void {
  menuOpen.value = false;
}

/**
 * 右键事件处理：屏蔽原生菜单并按解析结论打开菜单。
 *
 * @param e - 鼠标右键事件。
 * @returns 无返回值。
 */
function onContextMenu(e: MouseEvent): void {
  const resolution = resolveContextMenuEvent(e, { canReadClipboard: canReadClipboardText });
  if (resolution.action === "ignore") return;
  e.preventDefault();
  if (resolution.action === "none") {
    closeMenu();
    return;
  }
  menuX.value = resolution.request.x;
  menuY.value = resolution.request.y;
  request.value = resolution.request;
  menuOpen.value = true;
}

/**
 * 执行菜单动作并关闭菜单。
 *
 * @param key - 动作键。
 * @returns 无返回值。
 */
function onSelect(key: ContextMenuActionKey): void {
  const current = request.value;
  closeMenu();
  if (!current) return;
  void runContextMenuAction(key, current, {
    canReadClipboard: canReadClipboardText,
    readClipboardText,
    copyText: copyTextToClipboard,
    notifyWarn: (messageKey: string) => toast.warning(t(messageKey)),
  });
}

onMounted(() => document.addEventListener("contextmenu", onContextMenu));
onBeforeUnmount(() => document.removeEventListener("contextmenu", onContextMenu));
</script>

<template>
  <!-- 组件：ContextMenuHost｜职责：全局右键菜单（编辑/选区） -->
  <ContextMenuSurface :open="menuOpen" :x="menuX" :y="menuY" @close="closeMenu">
    <ContextMenuItem
      v-for="item in items"
      :key="item.key"
      :shortcut="item.shortcut"
      :disabled="item.disabled"
      @select="onSelect(item.key)"
    >
      {{ t(item.labelKey) }}
    </ContextMenuItem>
  </ContextMenuSurface>
</template>
