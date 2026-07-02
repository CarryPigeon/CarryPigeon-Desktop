<script setup lang="ts">
/**
 * @fileoverview 消息回应栏 — 消息下方展示 Emoji 回应列表及添加入口。
 */

import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import "emoji-picker-element";
import type { MessageReactionSummary } from "@/features/chat/message-flow/api-types";
import { getCurrentChatUserId } from "@/features/chat/composition/chatAccountSession";

const props = defineProps<{
  messageId: string;
  reactions: MessageReactionSummary[];
}>();

const emit = defineEmits<{
  (e: "react", messageId: string, emoji: string): void;
}>();

const { t } = useI18n();

const pickerVisible = ref(false);
const customEmojis = ref<Array<{ id: string; name: string; filePath: string }>>([]);
const emojiTab = ref<"standard" | "custom">("standard");

onMounted(async () => {
  try {
    const uid = getCurrentChatUserId();
    if (uid) {
      customEmojis.value = await invoke(TAURI_COMMANDS.listCustomEmojis, { uid });
    }
  } catch { /* ignore */ }
});

function handleReactionClick(emoji: string): void {
  emit("react", props.messageId, emoji);
}

/** 弹出位置修正计时器，用于组件卸载时清理。 */
let _popupFixTimer: ReturnType<typeof setInterval> | null = null;

onBeforeUnmount(() => {
  if (_popupFixTimer !== null) clearInterval(_popupFixTimer);
});

function onPickerVisibleChange(visible: boolean): void {
  pickerVisible.value = visible;
  if (visible) {
    if (_popupFixTimer !== null) clearInterval(_popupFixTimer);
    // 持续修正位置：emoji-picker 异步加载后可能触发 Popper.js 重新定位，
    // 如果超出视口则强制固定在视口内，防止被 Windows 窗口栏遮挡
    const timer = setInterval(() => {
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
    _popupFixTimer = timer;
    // 3 秒后停止检查（此时内容应已完全加载）
    const stopTimer = timer;
    setTimeout(() => {
      clearInterval(stopTimer);
      if (_popupFixTimer === stopTimer) {
        _popupFixTimer = null;
      }
    }, 3000);
  }
}

function onEmojiClick(e: Event): void {
  const detail = (e as CustomEvent).detail;
  const emoji = detail?.unicode ?? "";
  if (emoji) {
    emit("react", props.messageId, emoji);
    pickerVisible.value = false;
  }
}

function handleCustomEmojiClick(ce: { id: string; name: string }): void {
  emit("react", props.messageId, `custom:${ce.id}:${ce.name}`);
  pickerVisible.value = false;
}
</script>

<template>
  <div class="cp-reactionBar">
    <span
      v-for="r in reactions"
      :key="r.emoji"
      class="cp-reactionBadge"
      :class="{ 'cp-reactionBadge--mine': r.reactedByMe }"
      @click="handleReactionClick(r.emoji)"
    >
      {{ r.emoji }}&nbsp;{{ r.count }}
    </span>

    <t-popup
      trigger="click"
      placement="top"
      :visible="pickerVisible"
      @visible-change="onPickerVisibleChange"
      :overlayInnerStyle="{
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }"
    >
      <button class="cp-reactionAddBtn" type="button" :aria-label="t('add_reaction')">+</button>
      <template #content>
        <div class="cp-emojiTabs">
          <button :class="{ active: emojiTab === 'standard' }" @click="emojiTab = 'standard'">Emoji</button>
          <button :class="{ active: emojiTab === 'custom' }" @click="emojiTab = 'custom'">{{ customEmojis.length }}</button>
        </div>
        <emoji-picker v-if="emojiTab === 'standard'" data-source="/emoji-data.json" @emoji-click="onEmojiClick"></emoji-picker>
        <div v-else class="cp-customEmojiGrid">
          <button
            v-for="ce in customEmojis"
            :key="ce.id"
            class="cp-customEmojiBtn"
            @click="handleCustomEmojiClick(ce)"
            :title="`:${ce.name}:`"
          >
            <img :src="`asset://localhost/${encodeURIComponent(ce.filePath)}`" :alt="ce.name" class="cp-customEmojiImg" />
          </button>
          <div v-if="customEmojis.length === 0" class="cp-customEmojiEmpty">{{ t("no_custom_emojis") }}</div>
        </div>
      </template>
    </t-popup>
  </div>
</template>

<style scoped>
.cp-reactionBar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
  position: relative;
}

.cp-reactionBadge {
  font-size: 13px;
  background: var(--cp-bg-2);
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  user-select: none;
  border: 1px solid transparent;
  transition: background var(--cp-fast) var(--cp-ease), transform var(--cp-fast) var(--cp-ease);
}

.cp-reactionBadge:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg-2);
}

.cp-reactionBadge--mine {
  border-color: var(--cp-accent-soft);
  background: color-mix(in oklab, var(--cp-accent-soft) 60%, var(--cp-bg-2));
}

.cp-reactionAddBtn {
  font-size: 14px;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  border: 1px dashed var(--cp-border);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-text-muted);
  transition: background var(--cp-fast) var(--cp-ease), transform var(--cp-fast) var(--cp-ease);
}

.cp-reactionAddBtn:hover {
  background: var(--cp-hover-bg);
  transform: translateY(-1px);
}

.cp-emojiTabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}
.cp-emojiTabs button {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: transparent;
  color: var(--cp-text-muted);
  font-size: 12px;
  cursor: pointer;
}
.cp-emojiTabs button.active {
  background: var(--cp-accent);
  color: #fff;
  border-color: var(--cp-accent);
}

.cp-customEmojiGrid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  padding: 4px 0;
  max-height: 260px;
  overflow-y: auto;
}
.cp-customEmojiBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  transition: background var(--cp-fast) var(--cp-ease);
}
.cp-customEmojiBtn:hover {
  background: var(--cp-hover-bg);
}
.cp-customEmojiImg {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.cp-customEmojiEmpty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--cp-text-muted);
  font-size: 12px;
  padding: 20px 0;
}

</style>
