<script setup lang="ts">
/**
 * @fileoverview ChannelContextMenu.vue 文件职责说明。
 */

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

export type ChannelMenuAction = 
  | 'copyId' 
  | 'copyName' 
  | 'info'
  | 'pin' 
  | 'settings' 
  | 'deleteHistory'
  | 'settings_recv_notify'
  | 'settings_recv_silent'
  | 'settings_no_recv';

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  cid?: number;
  channelName: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'action', action: ChannelMenuAction): void;
}>();

const menuRef = ref<HTMLElement | null>(null);
const position = ref({ x: 0, y: 0 });
const showSettingsSubmenu = ref(false);

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
function emitAction(action: ChannelMenuAction) {
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
  <!-- 组件：频道右键菜单｜职责：频道操作入口（复制/设置/删除历史等） -->
  <Teleport to="body">
    <!-- 区块：<div> -->
    <div
      v-if="props.open"
      ref="menuRef"
      class="channel-context-menu"
      role="menu"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @contextmenu.prevent
    >
      <!-- 区块：<button> -->
      <button class="channel-context-menu-item" type="button" @click="emitAction('copyId')">
        {{ $t('copy_channel_id') }}
      </button>
      <!-- 区块：<button> -->
      <button class="channel-context-menu-item" type="button" @click="emitAction('copyName')">
        {{ $t('copy_channel_name') }}
      </button>
      <!-- 区块：<button> -->
      <button class="channel-context-menu-item" type="button" @click="emitAction('info')">
        {{ $t('channel_info') }}
      </button>
      <!-- 区块：<button> -->
      <button class="channel-context-menu-item" type="button" @click="emitAction('pin')">
        {{ $t('pin_channel') }}
      </button>
      
      <!-- 区块：<div> -->
      <div 
        class="channel-context-menu-item has-submenu" 
        @mouseenter="showSettingsSubmenu = true" 
        @mouseleave="showSettingsSubmenu = false"
      >
        <span>{{ $t('channel_settings') }}</span>
        <span class="submenu-arrow">›</span>
        
        <!-- 区块：<div> .channel-context-submenu -->
        <div v-if="showSettingsSubmenu" class="channel-context-submenu">
           <!-- 区块：<button> -->
           <button class="channel-context-menu-item" type="button" @click="emitAction('settings_recv_notify')">{{ $t('settings_recv_notify') }}</button>
           <!-- 区块：<button> -->
           <button class="channel-context-menu-item" type="button" @click="emitAction('settings_recv_silent')">{{ $t('settings_recv_silent') }}</button>
           <!-- 区块：<button> -->
           <button class="channel-context-menu-item" type="button" @click="emitAction('settings_no_recv')">{{ $t('settings_no_recv') }}</button>
        </div>
      </div>

      <!-- 区块：<button> -->
      <button class="channel-context-menu-item delete" type="button" @click="emitAction('deleteHistory')">
        {{ $t('delete_channel_history') }}
      </button>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：浮层菜单 + 子菜单（fixed 定位） */
.channel-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 160px;
  padding: 4px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius, 14px);
  box-shadow: var(--cp-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* 样式：.channel-context-menu-item */
.channel-context-menu-item {
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--cp-text, #1a1a1a);
  transition: background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  /* 样式：&:hover */
  &:hover {
    background-color: var(--cp-hover-bg);
  }

  /* 样式：&.delete */
  &.delete {
    color: var(--cp-danger);
    /* 样式：&:hover */
    &:hover {
      background-color: rgba(239, 68, 68, 0.12);
    }
  }
}

/* 样式：.has-submenu */
.has-submenu {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* 样式：.submenu-arrow */
.submenu-arrow {
  font-size: 14px;
  line-height: 1;
  margin-left: 8px;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.channel-context-submenu */
.channel-context-submenu {
  position: absolute;
  left: 100%;
  top: -4px;
  min-width: 160px;
  padding: 4px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius, 14px);
  box-shadow: var(--cp-shadow, 0 1px 3px rgba(0, 0, 0, 0.08));
  display: flex;
  flex-direction: column;
  margin-left: 4px;
  z-index: 10001;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
</style>
