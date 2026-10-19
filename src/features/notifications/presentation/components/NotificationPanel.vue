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
/* 样式：NotificationPanel｜规格：18px 玻璃浮层 + 行分隔 + 统一控件 token */
.cp-notif-panel {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.cp-notif-panel__inner {
  @include cp-glass-panel;

  position: absolute;
  top: 48px;
  right: 12px;
  width: 360px;
  max-height: 480px;
  box-shadow: var(--cp-shadow-float);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 浮层头：标题 + 全部已读 */
.cp-notif-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--cp-border-light);
}

.cp-notif-panel__title {
  font-family: var(--cp-font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--cp-text);
}

.cp-notif-panel__mark-all {
  border: 0;
  background: none;
  padding: 0;
  color: var(--cp-accent);
  cursor: pointer;
  font-size: 12.5px;
  line-height: 1.4;
  transition: color var(--cp-fast) var(--cp-ease);

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid var(--cp-highlight-border-strong);
    outline-offset: 2px;
    border-radius: 4px;
  }
}

.cp-notif-panel__empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--cp-text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.cp-notif-panel__list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* 列表行：相邻行细分隔线；未读行用设置页选中语言（高亮底 + 左侧细条） */
.cp-notif-panel__item {
  padding: 14px 16px;
  cursor: pointer;
  border-top: 1px solid var(--cp-border-light);
  transition: background-color var(--cp-fast) var(--cp-ease);

  &:first-child {
    border-top: 0;
  }

  &:hover {
    background: var(--cp-hover-bg);
  }

  &--unread {
    background: var(--cp-highlight-bg);
    box-shadow: inset 2px 0 0 var(--cp-highlight);
  }
}

.cp-notif-panel__item-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--cp-text);
  margin-bottom: 2px;
}

.cp-notif-panel__item-summary {
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-notif-panel__item-time {
  font-size: 11px;
  color: var(--cp-text-light);
  margin-top: 4px;
}
</style>
