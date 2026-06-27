<script setup lang="ts">
/**
 * @fileoverview AnnouncementBanner.vue
 * @description 频道公告摘要条，显示在频道头部，可点击查看详情。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ChatChannelAnnouncementRecord } from '@/features/chat/domain/types/chatApiModels';

const { t } = useI18n();

const props = defineProps<{
  announcement: ChatChannelAnnouncementRecord | null;
  hasUnread?: boolean;
}>();

const emit = defineEmits<{
  (event: 'viewDetail'): void;
  (event: 'dismiss'): void;
}>();

const summary = computed(() => {
  if (!props.announcement) return null;
  const text = props.announcement.content || '';
  return text.length > 80 ? text.slice(0, 80) + '...' : text;
});
</script>

<template>
  <div v-if="announcement && summary" class="cp-annBanner">
    <span class="cp-annBanner__icon">📢</span>
    <span v-if="hasUnread" class="cp-annBanner__dot" />
    <span class="cp-annBanner__text">{{ summary }}</span>
    <button class="cp-annBanner__btn" @click="emit('viewDetail')">{{ t('view_detail') }}</button>
    <button class="cp-annBanner__close" @click="emit('dismiss')"><t-icon name="close" /></button>
  </div>
</template>

<style scoped lang="scss">
.cp-annBanner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: color-mix(in oklab, var(--cp-accent) 8%, var(--cp-panel));
  border-bottom: 1px solid var(--cp-border);
  font-size: 12px;
  color: var(--cp-text);
}
.cp-annBanner__icon { flex-shrink: 0; }
.cp-annBanner__dot {
  width: 6px; height: 6px;
  background: var(--cp-danger);
  border-radius: 50%;
  flex-shrink: 0;
}
.cp-annBanner__text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-annBanner__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--cp-text);
  flex-shrink: 0;
}
.cp-annBanner__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  padding: 2px;
  font-size: 13px;
}
</style>
