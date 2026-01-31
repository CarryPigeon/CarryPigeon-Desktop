<script setup lang="ts">
/**
 * @fileoverview ChannelInfoPage.vue 文件职责说明。
 */

import { computed } from "vue";
import { useRoute } from "vue-router";
const route = useRoute();

const avatar = computed(() => String(route.query.avatar ?? ""));
const name = computed(() => String(route.query.name ?? ""));
const brief = computed(() => String(route.query.bio ?? route.query.description ?? ""));
const owner = computed(() => Number(route.query.owner ?? ""));
const isOfficial = computed(() => owner.value === -1);
</script>

<template>
  <!-- 页面：ChannelInfoPage｜职责：展示频道信息（新窗口） -->
  <!-- 区块：<div> .channel-info -->
  <div class="channel-info">
    <!-- 区块：<div> .channel-card -->
    <div class="channel-card">
      <!-- 区块：<div> .header -->
      <div class="header">
        <img v-if="avatar" class="avatar" :src="avatar" alt="channel" />
        <!-- 区块：<div> .avatar -->
        <div v-else class="avatar placeholder" aria-hidden="true"></div>
        <!-- 区块：<div> .meta -->
        <div class="meta">
          <!-- 区块：<div> .name -->
          <div class="name">{{ name || $t('channel_info') }}</div>
          <span v-if="isOfficial" class="badge">
            <span class="dot" aria-hidden="true"></span>
            {{ $t('official_channel') }}
          </span>
        </div>
      </div>

      <!-- 区块：<div> .brief -->
      <div class="brief">
        <!-- 区块：<div> .label -->
        <div class="label">{{ $t('channel_brief') }}</div>
        <!-- 区块：<div> .content -->
        <div class="content">{{ brief || $t('channel_brief_placeholder') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：.channel-info */
.channel-info {
  width: 100%;
  height: 100%;
  padding: 18px;
  box-sizing: border-box;
  background: transparent;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.channel-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  background: var(--cp-panel, rgba(17, 24, 39, 0.78));
  border: 1px solid var(--cp-border);
  border-radius: 22px;
  box-shadow: var(--cp-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: cp-fade-up 360ms var(--cp-ease, ease) both;
}

/* 样式：.header */
.header {
  display: flex;
  gap: 16px;
  align-items: center;
}

/* 样式：.avatar */
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  object-fit: cover;
  background: var(--cp-hover-bg);
  border: 1px solid var(--cp-border-light);
}

/* 样式：.avatar.placeholder */
.avatar.placeholder {
  background: var(--cp-hover-bg);
}

/* 样式：.meta */
.meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 样式：.name */
.name {
  font-size: 20px;
  font-weight: 600;
  color: var(--cp-text, rgba(248, 250, 252, 0.92));
}

/* 样式：.badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--cp-accent-soft);
  border: 1px solid var(--cp-border);
  color: var(--cp-accent);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-2));
  box-shadow: 0 10px 20px var(--cp-accent-shadow);
}

/* 样式：.brief */
.brief {
  background: rgba(148, 163, 184, 0.06);
  padding: 16px;
  border-radius: var(--cp-radius, 14px);
  border: 1px solid var(--cp-border-light);
}

/* 样式：.label */
.label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--cp-text-muted, rgba(226, 232, 240, 0.62));
  margin-bottom: 8px;
}

/* 样式：.content */
.content {
  font-size: 14px;
  color: var(--cp-text, rgba(248, 250, 252, 0.92));
  line-height: 1.5;
  min-height: 60px;
}
</style>
