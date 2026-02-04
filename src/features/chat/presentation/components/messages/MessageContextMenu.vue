<script setup lang="ts">
/**
 * @fileoverview MessageContextMenu.vue
 * @description Context menu for message actions (copy/reply/delete/forward).
 */

import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

export type MessageMenuAction = "copy" | "reply" | "delete" | "forward";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "action", action: MessageMenuAction): void;
}>();

const { t } = useI18n();

/**
 * Close the menu (emits `close`).
 *
 * @returns void
 */
function handleClose(): void {
  emit("close");
}

/**
 * Emit an action and close the menu.
 *
 * @param action - Selected menu action.
 * @returns void
 */
function handleAction(action: MessageMenuAction): void {
  emit("action", action);
  emit("close");
}

/**
 * Global handler to close the menu on:
 * - Escape key
 * - Any mouse click
 *
 * @param e - Window mouse/keyboard event.
 * @returns void
 */
function onGlobal(e: MouseEvent | KeyboardEvent): void {
  if (!props.open) return;
  if (e instanceof KeyboardEvent && e.key === "Escape") {
    e.preventDefault();
    handleClose();
    return;
  }
  if (e instanceof MouseEvent) handleClose();
}

/**
 * Component mount hook: register global close handlers.
 *
 * @returns void
 */
function handleMounted(): void {
  window.addEventListener("mousedown", onGlobal);
  window.addEventListener("keydown", onGlobal);
}

onMounted(handleMounted);

/**
 * Component unmount hook: remove global close handlers.
 *
 * @returns void
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("mousedown", onGlobal);
  window.removeEventListener("keydown", onGlobal);
}

onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 组件：MessageContextMenu｜职责：消息右键菜单 -->
  <!-- 区块：<div> .cp-msgmenu -->
  <teleport to="body">
    <div v-if="props.open" class="cp-msgmenu" :style="{ left: `${props.x}px`, top: `${props.y}px` }" role="menu">
      <button class="cp-msgmenu__item" type="button" role="menuitem" @click="handleAction('copy')">
        {{ t("copy_message") || t("copy") }}
      </button>
      <button class="cp-msgmenu__item" type="button" role="menuitem" @click="handleAction('reply')">
        {{ t("reply_message") }}
      </button>
      <button class="cp-msgmenu__item" type="button" role="menuitem" @click="handleAction('forward')">
        {{ t("forward_message") }}
      </button>
      <div class="cp-msgmenu__sep" aria-hidden="true"></div>
      <button class="cp-msgmenu__item danger" type="button" role="menuitem" @click="handleAction('delete')">
        {{ t("delete_message") }}
      </button>
    </div>
  </teleport>
</template>

<style scoped lang="scss">
/* MessageContextMenu styles */
/* Selector: `.cp-msgmenu` — floating menu surface (positioned by x/y). */
.cp-msgmenu {
  position: fixed;
  z-index: 60;
  min-width: 180px;
  border: 1px solid color-mix(in oklab, var(--cp-info) 18%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-panel) 92%, rgba(0, 0, 0, 0.05));
  border-radius: 16px;
  box-shadow: var(--cp-shadow);
  padding: 8px;
  backdrop-filter: blur(10px);
}

/* Selector: `.cp-msgmenu__item` — clickable menu row. */
.cp-msgmenu__item {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

/* Selector: `.cp-msgmenu__item:hover` — hover highlight. */
.cp-msgmenu__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
}

/* Selector: `.cp-msgmenu__sep` — separator line before destructive action. */
.cp-msgmenu__sep {
  margin: 6px 6px;
  height: 1px;
  background: var(--cp-border-light);
}

/* Selector: `.cp-msgmenu__item.danger` — destructive action coloring. */
.cp-msgmenu__item.danger {
  color: color-mix(in oklab, var(--cp-danger) 72%, var(--cp-text));
}

/* Selector: `.cp-msgmenu__item.danger:hover` — destructive hover background/border. */
.cp-msgmenu__item.danger:hover {
  border-color: color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}
</style>
