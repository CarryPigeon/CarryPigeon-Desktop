<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { getNotificationCapabilities } from "../../api";
import NotificationPanel from "./NotificationPanel.vue";
import AppIcon from "@/shared/ui/AppIcon.vue";

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
      <AppIcon name="notification" class="cp-notif-bell__icon" />
      <span v-if="unreadCount > 0" class="cp-notif-bell__badge">{{ unreadCount > 99 ? "99+" : unreadCount }}</span>
    </button>
    <NotificationPanel v-if="showPanel" @close="showPanel = false" />
  </div>
</template>

<style scoped lang="scss">
/* 样式：NotificationBell｜规格：顶栏图标按钮 + 危险色未读徽标 */
.cp-notif-bell {
  position: relative;
}

.cp-notif-bell__btn {
  @include cp-icon-button;

  position: relative;
}

.cp-notif-bell__icon {
  font-size: 20px;
}

/* 未读徽标：危险色底 + 反色文字（徽标文字色无对应 token，保留白色以在状态色上可读） */
.cp-notif-bell__badge {
  position: absolute;
  top: 0;
  right: 0;
  background: var(--cp-danger);
  color: #fff;
  font-size: 10px;
  line-height: 1;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  pointer-events: none;
}
</style>
