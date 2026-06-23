<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { getNotificationCapabilities } from "../../api";
import NotificationPanel from "./NotificationPanel.vue";

const { t } = useI18n();
const caps = getNotificationCapabilities();
const unreadCount = ref(0);
const showPanel = ref(false);
let unsubscribe: (() => void) | null = null;

onMounted(() => {
  unsubscribe = caps.observeUnreadCount((count) => {
    unreadCount.value = count;
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
});

function togglePanel(): void {
  showPanel.value = !showPanel.value;
}
</script>

<template>
  <div class="cp-notif-bell">
    <button class="cp-notif-bell__btn" @click="togglePanel" :title="t('notifications')">
      <svg class="cp-notif-bell__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      <span v-if="unreadCount > 0" class="cp-notif-bell__badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
    </button>
    <NotificationPanel v-if="showPanel" @close="showPanel = false" />
  </div>
</template>

<style scoped lang="scss">
.cp-notif-bell {
  position: relative;
}

.cp-notif-bell__btn {
  position: relative;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--cp-text);
  border-radius: 6px;
  display: flex;
  align-items: center;

  &:hover {
    background: var(--cp-hover);
  }
}

.cp-notif-bell__icon {
  width: 20px;
  height: 20px;
}

.cp-notif-bell__badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--cp-danger, #e34d59);
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  pointer-events: none;
}
</style>
