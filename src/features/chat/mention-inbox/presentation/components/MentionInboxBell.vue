<script setup lang="ts">
/**
 * @fileoverview MentionInboxBell.vue
 * @description 聊天顶栏提及收件箱入口，未读数来自 GET /api/mentions。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useObservedCapabilitySnapshot } from "@/shared/utils/useObservedCapabilitySnapshot";
import { getMentionInboxCapabilities } from "@/features/chat/mention-inbox/api";
import MentionInboxPanel from "./MentionInboxPanel.vue";

const { t } = useI18n();
const caps = getMentionInboxCapabilities();
const snapshot = useObservedCapabilitySnapshot(caps);
const showPanel = ref(false);

const badgeText = computed(() => {
  const count = snapshot.value.unreadCount;
  if (count <= 0 && !snapshot.value.unreadHasMore) return "";
  if (snapshot.value.unreadHasMore || count > 99) return "99+";
  return String(count);
});

onMounted(() => {
  void caps.refresh();
});

onBeforeUnmount(() => {
  showPanel.value = false;
});

function togglePanel(): void {
  showPanel.value = !showPanel.value;
  if (showPanel.value) void caps.refresh();
}
</script>

<template>
  <div class="cp-mention-bell">
    <button class="cp-mention-bell__btn" type="button" :title="t('mentions')" :aria-label="t('mentions')" @click="togglePanel">
      <t-icon name="notification" class="cp-mention-bell__icon" />
      <span v-if="badgeText" class="cp-mention-bell__badge">{{ badgeText }}</span>
    </button>
    <MentionInboxPanel v-if="showPanel" @close="showPanel = false" />
  </div>
</template>

<style scoped lang="scss">
.cp-mention-bell {
  position: relative;
}

.cp-mention-bell__btn {
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

.cp-mention-bell__icon {
  font-size: 20px;
}

.cp-mention-bell__badge {
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
