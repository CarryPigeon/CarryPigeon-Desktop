<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";

const { t } = useI18n();

defineProps<{
  preview: ChatLinkPreview;
}>();

defineEmits<{
  (e: "dismiss"): void;
}>();
</script>

<template>
  <div class="cp-linkPreview">
    <button class="cp-linkPreview__dismiss" type="button" :aria-label="t('close_link_preview')" @click="$emit('dismiss')">&times;</button>
    <div class="cp-linkPreview__body">
      <div class="cp-linkPreview__text">
        <div v-if="preview.siteName || preview.faviconUrl" class="cp-linkPreview__site">
          <img v-if="preview.faviconUrl" :src="preview.faviconUrl" class="cp-linkPreview__favicon" alt="" referrerpolicy="no-referrer" width="16" height="16" />
          <span v-if="preview.siteName">{{ preview.siteName }}</span>
        </div>
        <div v-if="preview.title" class="cp-linkPreview__title">{{ preview.title }}</div>
        <div v-if="preview.description" class="cp-linkPreview__desc">{{ preview.description }}</div>
      </div>
      <img v-if="preview.imageUrl" :src="preview.imageUrl" class="cp-linkPreview__thumb" alt="" referrerpolicy="no-referrer" />
    </div>
  </div>
</template>

<style scoped>
.cp-linkPreview {
  position: relative;
  border: 1px solid var(--cp-border);
  border-radius: 12px;
  padding: 10px;
  margin-top: 8px;
  background: var(--cp-panel-muted);
}
.cp-linkPreview__dismiss {
  position: absolute;
  top: 4px; right: 4px;
  border: none;
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  z-index: 1;
}
.cp-linkPreview__body {
  display: flex;
  gap: 10px;
}
.cp-linkPreview__text {
  flex: 1;
  min-width: 0;
}
.cp-linkPreview__site {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-bottom: 4px;
}
.cp-linkPreview__favicon { border-radius: 2px; flex-shrink: 0; }
.cp-linkPreview__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-linkPreview__desc {
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-top: 4px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cp-linkPreview__thumb {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}
</style>
