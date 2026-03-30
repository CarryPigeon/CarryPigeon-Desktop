<script setup lang="ts">
/**
 * @fileoverview ChannelSettingsMenu.vue
 * @description 频道设置菜单（Teleport 到 body 的浮层菜单）。
 */

import { onBeforeUnmount, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  /**
   * 是否展示菜单。
   */
  open: boolean;
  /**
   * 菜单左上角 x 坐标（px）。
   */
  x: number;
  /**
   * 菜单左上角 y 坐标（px）。
   */
  y: number;
}>();

const emit = defineEmits<{
  /**
   * 关闭菜单（点击 backdrop 或外部触发）。
   */
  (e: "close"): void;
  /**
   * 打开成员页。
   */
  (e: "members"): void;
  /**
   * 打开入群申请页。
   */
  (e: "applications"): void;
  /**
   * 打开封禁页。
   */
  (e: "bans"): void;
  /**
   * 触发删除频道。
   */
  (e: "delete"): void;
}>();

const { t } = useI18n();

/**
 * 点击某个菜单项后关闭菜单。
 *
 * @param fn - 要执行的动作。
 */
function runAndClose(fn: () => void): void {
  fn();
  emit("close");
}

/**
 * 全局快捷关闭：Esc 关闭菜单。
 *
 * @param e - 键盘事件。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key !== "Escape") return;
  e.preventDefault();
  emit("close");
}

/**
 * 组件挂载时注册全局 Esc 关闭监听。
 */
function handleMounted(): void {
  window.addEventListener("keydown", onGlobalKeydown);
}

onMounted(handleMounted);

/**
 * 组件卸载时移除全局监听。
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("keydown", onGlobalKeydown);
}

onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 组件：ChannelSettingsMenu｜职责：频道设置菜单（Teleport 浮层） -->
  <teleport to="body">
    <div
      v-if="props.open"
      class="cp-channelMenu"
      :style="{ left: `${props.x}px`, top: `${props.y}px` }"
      role="menu"
      aria-label="Channel settings menu"
      @click.stop
    >
      <button class="cp-channelMenu__item" type="button" role="menuitem" @click="runAndClose(() => emit('members'))">
        {{ t("channel_members") }}
      </button>
      <button class="cp-channelMenu__item" type="button" role="menuitem" @click="runAndClose(() => emit('applications'))">
        {{ t("join_applications") }}
      </button>
      <button class="cp-channelMenu__item" type="button" role="menuitem" @click="runAndClose(() => emit('bans'))">
        {{ t("channel_bans") }}
      </button>
      <div class="cp-channelMenu__sep"></div>
      <button class="cp-channelMenu__item danger" type="button" role="menuitem" @click="runAndClose(() => emit('delete'))">
        {{ t("delete_channel") }}
      </button>
    </div>
    <div v-if="props.open" class="cp-channelMenu__backdrop" @click="emit('close')"></div>
  </teleport>
</template>
