<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getNotificationCapabilities } from "../../api";
import type { AppNotification } from "../../domain/contracts";

const { t } = useI18n();
const emit = defineEmits<{ close: [] }>();
const caps = getNotificationCapabilities();
const notifications = ref<AppNotification[]>([]);

onMounted(() => {
  notifications.value = caps.getAll();
});

function markRead(id: string): void {
  caps.markRead(id);
  notifications.value = caps.getAll();
}

function markAllRead(): void {
  caps.markAllRead();
  notifications.value = caps.getAll();
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return t("time_just_now");
  if (diff < 3600000) return t("time_minutes_ago", { n: Math.floor(diff / 60000) });
  return d.toLocaleTimeString();
}
</script>

<template>
  <div class="cp-notif-panel" @click.self="emit('close')">
    <div class="cp-notif-panel__inner">
      <div class="cp-notif-panel__header">
        <span class="cp-notif-panel__title">{{ t("notifications") }}</span>
        <button v-if="notifications.some((n) => !n.read)" class="cp-notif-panel__mark-all" @click="markAllRead">
          {{ t("mark_all_read") }}
        </button>
      </div>
      <div v-if="notifications.length === 0" class="cp-notif-panel__empty">
        {{ t("no_notifications") }}
      </div>
      <div v-else class="cp-notif-panel__list">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="cp-notif-panel__item"
          :class="{ 'cp-notif-panel__item--unread': !n.read }"
          @click="markRead(n.id)"
        >
          <div class="cp-notif-panel__item-title">{{ n.title }}</div>
          <div class="cp-notif-panel__item-summary">{{ n.summary }}</div>
          <div class="cp-notif-panel__item-time">{{ formatTime(n.timestamp) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-notif-panel {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.cp-notif-panel__inner {
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

.cp-notif-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cp-border);
}

.cp-notif-panel__title {
  font-weight: 600;
  font-size: 15px;
}

.cp-notif-panel__mark-all {
  background: none;
  border: none;
  color: var(--cp-accent);
  cursor: pointer;
  font-size: 13px;

  &:hover {
    text-decoration: underline;
  }
}

.cp-notif-panel__empty {
  padding: 32px;
  text-align: center;
  color: var(--cp-text-secondary);
  font-size: 14px;
}

.cp-notif-panel__list {
  overflow-y: auto;
  flex: 1;
}

.cp-notif-panel__item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--cp-border);
  transition: background 0.15s;

  &:hover {
    background: var(--cp-hover);
  }

  &--unread {
    background: var(--cp-accent-bg, rgba(64, 128, 255, 0.06));
  }
}

.cp-notif-panel__item-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.cp-notif-panel__item-summary {
  font-size: 13px;
  color: var(--cp-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-notif-panel__item-time {
  font-size: 11px;
  color: var(--cp-text-tertiary);
  margin-top: 4px;
}
</style>
