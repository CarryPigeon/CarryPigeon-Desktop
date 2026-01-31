<script setup lang="ts">
/**
 * @fileoverview MessageContextMenu.vue 文件职责说明。
 */

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

type MenuAction = 'copy' | 'recall' | 'forward';

const props = withDefaults(
  defineProps<{
    open: boolean;
    x: number;
    y: number;
    showRecall?: boolean;
  }>(),
  {
    showRecall: false,
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'action', action: MenuAction): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });

/**
 * close 方法说明。
 * @returns 返回值说明。
 */
function close() {
  emit('update:open', false);
}

/**
 * emitAction 方法说明。
 * @param action - 参数说明。
 * @returns 返回值说明。
 */
function emitAction(action: MenuAction) {
  emit('action', action);
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
  if (event.key === 'Escape') close();
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
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
      window.removeEventListener('resize', onWindowResize);
      return;
    }

    void updatePosition();

    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    window.addEventListener('resize', onWindowResize);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
  window.removeEventListener('resize', onWindowResize);
});
</script>

<template>
  <!-- 组件：MessageContextMenu｜职责：消息右键菜单（复制/转发/撤回）；交互：点击外部/ESC 关闭 -->
  <Teleport to="body">
    <!-- 区块：<div> -->
    <div
      v-if="props.open"
      ref="menuRef"
      class="message-context-menu"
      role="menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @contextmenu.prevent
    >
      <!-- 区块：<button> -->
      <button class="message-context-menu-item" type="button" @click="emitAction('copy')">
        {{ $t('copy_message') }}
      </button>
      <!-- 区块：<button> -->
      <button
        v-if="props.showRecall"
        class="message-context-menu-item"
        type="button"
        @click="emitAction('recall')"
      >
        {{ $t('recall_message') }}
      </button>
      <!-- 区块：<button> -->
      <button class="message-context-menu-item" type="button" @click="emitAction('forward')">
        {{ $t('forward_message') }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：浮层菜单（fixed 定位） */
.message-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 120px;
  padding: 4px;
  background: var(--cp-panel, rgba(17, 24, 39, 0.78));
  border: 1px solid var(--cp-border, rgba(148, 163, 184, 0.18));
  border-radius: var(--cp-radius, 14px);
  box-shadow: var(--cp-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* 样式：.message-context-menu-item */
.message-context-menu-item {
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  font-size: 14px;
  color: var(--cp-text, rgba(248, 250, 252, 0.92));
  transition: background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:hover */
  &:hover {
    background-color: var(--cp-accent-soft);
  }
}
</style>
