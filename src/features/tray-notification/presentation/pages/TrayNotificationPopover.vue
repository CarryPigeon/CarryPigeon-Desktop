<script setup lang="ts">
/**
 * @fileoverview 页面：TrayNotificationPopover.vue
 * @description tray-notification｜页面：TrayNotificationPopover。
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { emit } from "@tauri-apps/api/event";
import { createLogger } from "@/shared/utils/logger";
import type { UnreadMessagePreview } from "@/features/chat/public/api-types";

const { t, locale } = useI18n();

const logger = createLogger("TrayNotificationPopover");

const route = useRoute();

const items = computed<UnreadMessagePreview[]>(() => {
  try {
    const raw = route.query.data;
    return JSON.parse(decodeURIComponent(typeof raw === "string" ? raw : "[]"));
  } catch {
    return [];
  }
});

const sortedItems = computed(() => {
  return [...items.value].sort((a, b) => Number(Boolean(b.mentionedMe)) - Number(Boolean(a.mentionedMe)));
});

function formatTime(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60000) return t("time_just_now");
  if (diff < 3600000) return t("time_minutes_ago", { n: Math.floor(diff / 60000) });
  if (diff < 86400000) return t("time_hours_ago", { n: Math.floor(diff / 3600000) });
  const dateLocale = String(locale.value).startsWith("zh") ? "zh-CN" : "en-US";
  return new Date(ms).toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
  });
}

async function handleClick(channelId: string) {
  try {
    await invokeTauri<void>(TAURI_COMMANDS.closeTrayNotificationPopover);
    await emit("jump-to-channel", { channelId });
  } catch (err) {
    logger.warn("Action: chat_tray_notification_click_failed", { error: String(err) });
  }
}
</script>

<template>
  <main class="cp-notif">
    <div class="cp-notif__header">{{ t("tray_unread_count", { n: items.length }) }}</div>
    <div v-if="sortedItems.length === 0" class="cp-notif__empty">{{ t("no_messages") }}</div>
    <div
      v-for="(item, idx) in sortedItems"
      :key="item.messageId || idx"
      class="cp-notif__item"
      @click="handleClick(item.channelId)"
    >
      <div class="cp-notif__item-top">
        <span class="cp-notif__sender">{{ item.senderName }}</span>
        <span class="cp-notif__channel-tag">{{ item.channelName }}</span>
        <span class="cp-notif__time">{{ formatTime(item.timeMs) }}</span>
      </div>
      <div class="cp-notif__preview">{{ item.textPreview }}</div>
    </div>
  </main>
</template>

<style scoped lang="scss">
/* 样式：TrayNotificationPopover｜规格：18px 玻璃窗口 + 分组行 */
.cp-notif {
  @include cp-glass-panel;

  height: 100%;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cp-notif__header {
  @include cp-section-label;

  padding: 6px 16px 10px;
  border-bottom: 1px solid var(--cp-border-light);
}

.cp-notif__empty {
  padding: 28px 16px;
  text-align: center;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-notif__item {
  padding: 10px 16px;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
  }

  & + & {
    border-top: 1px solid var(--cp-border-light);
  }
}

.cp-notif__item-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-notif__sender {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-notif__channel-tag {
  flex-shrink: 0;
  padding: 1px 7px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  font-family: var(--cp-font-mono);
  font-size: 10px;
  color: var(--cp-text-muted);
}

.cp-notif__time {
  margin-left: auto;
  font-size: 11px;
  color: var(--cp-text-muted);
  flex-shrink: 0;
}

.cp-notif__preview {
  margin-top: 3px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
