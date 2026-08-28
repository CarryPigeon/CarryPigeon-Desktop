<script setup lang="ts">
/**
 * @fileoverview MentionInboxPanel.vue
 * @description 提及收件箱面板：列表、未读筛选、单项已读、全部已读、点击进频道。
 */
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { getMentionInboxCapabilities } from "@/features/chat/mention-inbox/api";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import { getAccountCapabilities } from "@/features/account/api";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { readAuthToken } from "@/shared/utils/localState";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("mention-inbox-panel");
const { t } = useI18n();
const emit = defineEmits<{ close: [] }>();
const caps = getMentionInboxCapabilities();
const snapshot = useObservedCapabilitySnapshot(caps);
const directory = getRoomSessionCapabilities().directory;
const currentSession = useObservedCapabilitySnapshot(getRoomSessionCapabilities().currentChannel);
const senderNames = ref<Record<string, string>>({});

function channelName(channelId: string): string {
  return directory.findChannelById(channelId)?.name || channelId;
}

function senderLabel(fromUserId: string): string {
  return senderNames.value[fromUserId] || fromUserId;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return t("time_just_now");
  if (diff < 3600000) return t("time_minutes_ago", { n: Math.floor(diff / 60000) });
  return d.toLocaleString();
}

const currentChannelId = computed(() => currentSession.value.currentChannelId);
const filterCurrentChannel = computed(() => Boolean(snapshot.value.channelId));

async function resolveSenders(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const missing = unique.filter((id) => !senderNames.value[id]);
  if (missing.length === 0) return;
  const socket = getActiveChatServerSocket().trim();
  if (!socket) return;
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  if (!token) return;
  try {
    const users = await getAccountCapabilities().forServer(socket).listUsers(token, missing);
    const next = { ...senderNames.value };
    for (const user of users) {
      if (user.uid) next[user.uid] = user.nickname || user.uid;
    }
    senderNames.value = next;
  } catch (error) {
    logger.warn("Action: chat_mention_inbox_resolve_senders_failed", { error: String(error) });
  }
}

watch(
  () => snapshot.value.items.map((row) => row.fromUserId).join(","),
  () => {
    void resolveSenders(snapshot.value.items.map((row) => row.fromUserId));
  },
  { immediate: true },
);

onMounted(() => {
  void caps.refresh();
});

async function handleOpen(mentionId: string): Promise<void> {
  emit("close");
  await caps.openMention(mentionId);
}

async function markAllRead(): Promise<void> {
  await caps.markAllRead();
}

async function toggleUnreadOnly(): Promise<void> {
  await caps.setUnreadOnly(!snapshot.value.unreadOnly);
}

async function toggleCurrentChannel(): Promise<void> {
  const next = filterCurrentChannel.value ? "" : currentChannelId.value;
  await caps.setChannelId(next);
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
      <div class="cp-mention-panel__filters">
        <button
          class="cp-mention-panel__filter"
          type="button"
          :data-active="snapshot.unreadOnly"
          @click="toggleUnreadOnly"
        >
          {{ t("mentions_unread_only") }}
        </button>
        <button
          class="cp-mention-panel__filter"
          type="button"
          :disabled="!currentChannelId"
          :data-active="filterCurrentChannel"
          @click="toggleCurrentChannel"
        >
          {{ t("mentions_current_channel") }}
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
        <article
          v-for="n in snapshot.items"
          :key="n.mentionId"
          class="cp-mention-panel__item"
          :class="{ 'cp-mention-panel__item--unread': !n.read }"
        >
          <button class="cp-mention-panel__item-main" type="button" @click="handleOpen(n.mentionId)">
            <div class="cp-mention-panel__item-title">{{ channelName(n.channelId) }}</div>
            <div class="cp-mention-panel__item-summary">
              {{ t("mention_inbox_from", { name: senderLabel(n.fromUserId) }) }}
            </div>
            <div class="cp-mention-panel__item-time">{{ formatTime(n.createdAt) }}</div>
          </button>
          <button
            v-if="!n.read"
            class="cp-mention-panel__item-read"
            type="button"
            @click="caps.markRead(n.mentionId)"
          >
            {{ t("mark_read") }}
          </button>
        </article>
        <button
          v-if="snapshot.hasMore"
          class="cp-mention-panel__more"
          type="button"
          :disabled="snapshot.loading"
          @click="caps.loadMore()"
        >
          {{ snapshot.loading ? t("loading") : t("load_more") }}
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

.cp-mention-panel__filters {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--cp-border);
}

.cp-mention-panel__filter {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;

  &[data-active="true"] {
    border-color: var(--cp-highlight-border-strong, var(--cp-accent));
    background: var(--cp-highlight-bg, var(--cp-accent-bg, rgba(64, 128, 255, 0.12)));
    color: var(--cp-text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  width: 100%;
  padding: 0;
  border-bottom: 1px solid var(--cp-border);
  position: relative;

  &--unread {
    background: var(--cp-accent-bg, rgba(64, 128, 255, 0.06));
  }
}

.cp-mention-panel__item-main {
  display: block;
  width: 100%;
  text-align: left;
  padding: 12px 16px;
  cursor: pointer;
  border: 0;
  background: transparent;
  color: inherit;

  &:hover {
    background: var(--cp-hover);
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

.cp-mention-panel__item-read {
  margin: 12px 12px 0 0;
  border: 0;
  background: none;
  font-size: 12px;
  color: var(--cp-accent);
  cursor: pointer;
}

.cp-mention-panel__more {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  padding: 10px;
  cursor: pointer;
  font-size: 12px;
}
</style>
