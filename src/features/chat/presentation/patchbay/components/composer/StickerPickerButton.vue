<script setup lang="ts">
/**
 * @fileoverview StickerPickerButton.vue
 * @description 编辑工具栏"表情"按钮，点击弹出表情选择面板。
 */

import { ref, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import StickerPickerPanel from "./StickerPickerPanel.vue";

const props = defineProps<{
  currentUserId: string;
}>();

const emit = defineEmits<{
  (e: "sticker", result: { fileId: string; shareKey: string }): void;
  (e: "sendText", text: string): void;
}>();

const { t } = useI18n();

/** 弹出位置修正计时器，用于组件卸载时清理。 */
let _popupFixTimer: ReturnType<typeof setInterval> | null = null;

onBeforeUnmount(() => {
  if (_popupFixTimer !== null) clearInterval(_popupFixTimer);
});

const popupVisible = ref(false);

function onPopupVisibleChange(visible: boolean): void {
  popupVisible.value = visible;
  if (visible) {
    // 防止 popup 超出视口顶部被 Windows 窗口栏遮挡
    _popupFixTimer = setInterval(() => {
      const popup = document.querySelector('[data-td-popup] > .t-popup__content');
      if (!popup) return;
      const rect = popup.getBoundingClientRect();
      if (rect.top < 0) {
        const parent = popup.closest('[data-td-popup]') as HTMLElement | null;
        if (parent) {
          parent.style.setProperty('top', '8px', 'important');
          parent.style.setProperty('bottom', 'auto', 'important');
        }
      }
    }, 100);
    setTimeout(() => {
      if (_popupFixTimer !== null) {
        clearInterval(_popupFixTimer);
        _popupFixTimer = null;
      }
    }, 3000);
  }
}

function onStickerSelect(shareKey: string): void {
  popupVisible.value = false;
  emit("sticker", { fileId: "", shareKey });
}

function onEmojiSelect(emoji: string): void {
  popupVisible.value = false;
  emit("sendText", emoji);
}
</script>

<template>
  <t-popup
    trigger="click"
    placement="top"
    :visible="popupVisible"
    @visible-change="onPopupVisibleChange"
    :overlayInnerStyle="{
      maxHeight: 'calc(100vh - 80px)',
      overflowY: 'auto',
    }"
  >
    <button class="cp-stickerBtn" type="button">
      <span class="cp-stickerBtn__icon">😊</span>
      <span class="cp-stickerBtn__text">{{ t("emoji") || "表情" }}</span>
    </button>
    <template #content>
      <StickerPickerPanel
        :current-user-id="props.currentUserId"
        @select="onStickerSelect"
        @emoji-select="onEmojiSelect"
      />
    </template>
  </t-popup>
</template>

<style scoped>
.cp-stickerBtn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-stickerBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-stickerBtn__icon {
  font-size: 16px;
  line-height: 1;
}

.cp-stickerBtn__text {
  font-size: 12px;
}
</style>
