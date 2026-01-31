<script setup lang="ts">
/**
 * @fileoverview MemberContextMenu.vue 文件职责说明。
 */

import { nextTick, onBeforeUnmount, ref, watch } from "vue";

export type MemberMenuAction =
  | "sendMessage"
  | "mention"
  | "viewProfile"
  | "report"
  | "toggleMute";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  muted?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "action", action: MemberMenuAction): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

/**
 * close 方法说明。
 * @returns 返回值说明。
 */
function close() {
  emit("update:open", false);
}

/**
 * emitAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
function emitAction(action: MemberMenuAction) {
  emit("action", action);
  close();
}

/**
 * updatePosition 方法说明。
 * @returns 返回值说明。
 */
async function updatePosition() {
  position.value = { x: props.x, y: props.y };
  await nextTick();

  const el = menuRef.value;
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const padding = 8;

  let x = props.x;
  let y = props.y;

  if (x + rect.width + padding > window.innerWidth) {
    x = Math.max(padding, window.innerWidth - rect.width - padding);
  }

  if (y + rect.height + padding > window.innerHeight) {
    y = Math.max(padding, window.innerHeight - rect.height - padding);
  }

  position.value = { x, y };
}

/**
 * onDocumentPointerDown 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
const onDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null;
  if (target && menuRef.value?.contains(target)) return;
  close();
};

/**
 * onDocumentKeyDown 方法说明。
 * @param event - 参数说明。
 * @returns 返回值说明。
 */
const onDocumentKeyDown = (event: KeyboardEvent) => {
  if (event.key === "Escape") close();
};

/**
 * onWindowResize 方法说明。
 * @returns 返回值说明。
 */
const onWindowResize = () => {
  close();
};

watch(
  () => props.open,
  (open) => {
    if (!open) {
      document.removeEventListener("pointerdown", onDocumentPointerDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
      window.removeEventListener("resize", onWindowResize);
      return;
    }

    void updatePosition();

    document.addEventListener("pointerdown", onDocumentPointerDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    window.addEventListener("resize", onWindowResize);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointerDown);
  document.removeEventListener("keydown", onDocumentKeyDown);
  window.removeEventListener("resize", onWindowResize);
});
</script>

<template>
  <!-- 组件：MemberContextMenu｜职责：成员右键菜单（Teleport 到 body）；交互：点击外部/ESC 关闭 -->
  <Teleport to="body">
    <!-- 区块：<div> -->
    <div
      v-if="props.open"
      ref="menuRef"
      class="member-context-menu"
      role="menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @contextmenu.prevent
    >
      <!-- 区块：<button> -->
      <button class="member-context-menu-item" type="button" @click="emitAction('sendMessage')">
        {{ $t("member_send_message") }}
      </button>
      <!-- 区块：<button> -->
      <button class="member-context-menu-item" type="button" @click="emitAction('mention')">
        {{ $t("member_mention") }}
      </button>
      <!-- 区块：<button> -->
      <button class="member-context-menu-item" type="button" @click="emitAction('viewProfile')">
        {{ $t("member_view_profile") }}
      </button>
      <!-- 区块：<button> -->
      <button class="member-context-menu-item warn" type="button" @click="emitAction('report')">
        {{ $t("member_report_user") }}
      </button>
      <!-- 区块：<button> -->
      <button class="member-context-menu-item" type="button" @click="emitAction('toggleMute')">
        {{ props.muted ? $t("member_unmute") : $t("member_mute") }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：浮层菜单（fixed 定位） */
.member-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 4px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius, 14px);
  box-shadow: var(--cp-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
}

/* 样式：.member-context-menu-item */
.member-context-menu-item {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--cp-text, #1a1a1a);
  transition: background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:hover */
  &:hover {
    background-color: var(--cp-hover-bg);
  }

  /* 样式：&.warn */
  &.warn {
    color: var(--cp-accent-2);
    /* 样式：&:hover */
    &:hover {
      background-color: var(--cp-accent-2-soft);
    }
  }
}
</style>
