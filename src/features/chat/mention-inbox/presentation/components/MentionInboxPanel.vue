<script setup lang="ts">
/**
 * @fileoverview MentionInboxPanel.vue
 * @description 提及收件箱面板：列表、单项已读、全部已读、点击进频道。
 */
import { useI18n } from "vue-i18n";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { getMentionInboxCapabilities } from "@/features/chat/mention-inbox/api";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";

const { t } = useI18n();
const emit = defineEmits<{ close: [] }>();
const caps = getMentionInboxCapabilities();
const snapshot = useObservedCapabilitySnapshot(caps);
const directory = getRoomSessionCapabilities().directory;

function channelName(channelId: string): string {
  return directory.findChannelById(channelId)?.name || channelId;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return t("time_just_now");
  if (diff < 3600000) return t("time_minutes_ago", { n: Math.floor(diff / 60000) });
  return d.toLocaleString();
}

async function handleOpen(mentionId: string): Promise<void> {
  emit("close");
  await caps.openMention(mentionId);
}

async function markAllRead(): Promise<void> {
  await caps.markAllRead();
}
</script>

<template>
  <div class="cp-mention-panel" @click.self="emit('close')">
    <div class="cp-mention-panel__inner">
      <div class="cp-mention-panel__header">
        <span class="cp-mention-panel__title">{{ t("mentions") }}</span>
        <button
          v-if="snapshot.items.some((n) => !n.read) || snapshot.unreadCount > 0"
          class="cp-mention-panel__mark-all"
          type="button"
          @click="markAllRead"
        >
          {{ t("mark_all_read") }}
        </button>
      </div>
      <div v-if="snapshot.loading && snapshot.items.length === 0" class="cp-mention-panel__empty">
        {{ t("loading") }}
      </div>
      <div v-else-if="snapshot.error && snapshot.items.length === 0" class="cp-mention-panel__empty">
        {{ snapshot.error }}
      </div>
      <div v-else-if="snapshot.items.length === 0" class="cp-mention-panel__empty">
        {{ t("no_mentions") }}
      </div>
      <div v-else class="cp-mention-panel__list">
        <button
          v-for="n in snapshot.items"
          :key="n.mentionId"
          class="cp-mention-panel__item"
          :class="{ 'cp-mention-panel__item--unread': !n.read }"
          type="button"
          @click="handleOpen(n.mentionId)"
        >
          <div class="cp-mention-panel__item-title">{{ channelName(n.channelId) }}</div>
          <div class="cp-mention-panel__item-summary">{{ t("mention_inbox_item") }}</div>
          <div class="cp-mention-panel__item-time">{{ formatTime(n.createdAt) }}</div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-mention-panel {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.cp-mention-panel__inner {
  position: absolute;
  top: 48px;
  right: 12px;
  width: 360px;
  max-height: 480px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  box-shadow: var(--cp-shadow-strong);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cp-mention-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cp-border);
}

.cp-mention-panel__title {
  font-weight: 600;
  font-size: 15px;
}

.cp-mention-panel__mark-all {
  background: none;
  border: none;
  color: var(--cp-accent);
  cursor: pointer;
  font-size: 13px;

  &:hover {
    text-decoration: underline;
  }
}

.cp-mention-panel__empty {
  padding: 32px;
  text-align: center;
  color: var(--cp-text-secondary);
  font-size: 14px;
}

.cp-mention-panel__list {
  overflow-y: auto;
  flex: 1;
}

.cp-mention-panel__item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  cursor: pointer;
  border: 0;
  background: transparent;
  color: inherit;
  border-bottom: 1px solid var(--cp-border);

  &:hover {
    background: var(--cp-hover);
  }

  &--unread {
    background: var(--cp-accent-bg, rgba(64, 128, 255, 0.06));
  }
}

.cp-mention-panel__item-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.cp-mention-panel__item-summary {
  font-size: 13px;
  color: var(--cp-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-mention-panel__item-time {
  font-size: 11px;
  color: var(--cp-text-tertiary);
  margin-top: 4px;
}
</style>
