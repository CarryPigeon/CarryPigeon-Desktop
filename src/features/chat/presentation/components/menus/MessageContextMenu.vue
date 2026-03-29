<script setup lang="ts">
/**
 * @fileoverview MessageContextMenu.vue
 * @description chat｜组件：MessageContextMenu。
 */

import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

type MessageMenuAction = "copy" | "reply" | "delete" | "forward";

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
 * 关闭菜单（触发 `close` 事件）。
 *
 * @returns 无返回值。
 */
function handleClose(): void {
  emit("close");
}

/**
 * 派发菜单动作并关闭菜单。
 *
 * @param action - 选中的菜单动作。
 * @returns 无返回值。
 */
function handleAction(action: MessageMenuAction): void {
  emit("action", action);
  emit("close");
}

/**
 * 全局键盘关闭处理器（Escape）。
 *
 * 说明：
 * 不使用全局 mousedown 关闭，避免在菜单项点击时先触发关闭导致动作丢失。
 *
 * @param e - Window 键盘事件。
 * @returns 无返回值。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key !== "Escape") return;
  e.preventDefault();
  handleClose();
}

/**
 * 组件挂载：注册全局关闭监听。
 *
 * @returns 无返回值。
 */
function handleMounted(): void {
  window.addEventListener("keydown", onGlobalKeydown);
}

onMounted(handleMounted);

/**
 * 组件卸载：移除全局监听。
 *
 * @returns 无返回值。
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("keydown", onGlobalKeydown);
}

onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 组件：MessageContextMenu｜职责：消息右键菜单 -->
  <!-- 区块：<div> .cp-msgmenu -->
  <teleport to="body">
    <template v-if="props.open">
      <div class="cp-msgmenu__backdrop" @click="handleClose"></div>
      <div
        class="cp-msgmenu"
        :style="{ left: `${props.x}px`, top: `${props.y}px` }"
        role="menu"
        @click.stop
      >
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
    </template>
  </teleport>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；菜单为固定定位浮层，通过 x/y 定位，含分隔线与危险动作样式。 */
.cp-msgmenu__backdrop {
  position: fixed;
  z-index: 59;
  inset: 0;
}

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

.cp-msgmenu__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
}

.cp-msgmenu__sep {
  margin: 6px 6px;
  height: 1px;
  background: var(--cp-border-light);
}

.cp-msgmenu__item.danger {
  color: color-mix(in oklab, var(--cp-danger) 72%, var(--cp-text));
}

.cp-msgmenu__item.danger:hover {
  border-color: color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}
</style>
