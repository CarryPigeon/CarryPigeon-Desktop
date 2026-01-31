<script setup lang="ts">
/**
 * @fileoverview UserPopoverPage.vue 文件职责说明。
 */

import { computed } from "vue";
import { useRoute } from "vue-router";

const route = useRoute();

const avatar = computed(() => String(route.query.avatar ?? ""));
const name = computed(() => String(route.query.name ?? ""));
const email = computed(() => String(route.query.email ?? ""));
const bio = computed(() => String(route.query.bio ?? route.query.description ?? ""));
</script>

<template>
  <!-- 页面：UserPopoverPage｜职责：用户信息弹窗（路由 query 传参） -->
  <!-- 区块：<div> .card -->
  <div class="card">
    <!-- 区块：<div> .header -->
    <div class="header">
      <img v-if="avatar" class="avatar" :src="avatar" alt="avatar" />
      <!-- 区块：<div> .avatar -->
      <div v-else class="avatar placeholder" aria-hidden="true"></div>

      <!-- 区块：<div> .meta -->
      <div class="meta">
        <!-- 区块：<div> .name -->
        <div class="name" :title="name">{{ name }}</div>
        <!-- 区块：<div> .email -->
        <div v-if="email" class="email" :title="email">{{ email }}</div>
        <!-- 区块：<div> .email -->
        <div v-else class="email muted">&nbsp;</div>
      </div>
    </div>

    <!-- 区块：<div> .bio -->
    <div v-if="bio" class="bio" :title="bio">{{ bio }}</div>
    <!-- 区块：<div> .bio-muted -->
    <div v-else class="bio-muted">&nbsp;</div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：Popover 卡片（透明背景适配 Tauri 窗口） */
:global(html),
/* 样式：:global(body) */
:global(body) {
  margin: 0;
  padding: 0;
  background: transparent;
}

/* 样式：.card */
.card {
  width: 100vw;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--cp-panel, rgba(17, 24, 39, 0.78));
  border: 1px solid var(--cp-border);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  overflow: hidden;
  animation: cp-fade-up 260ms var(--cp-ease, ease) both;
}

.card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(600px 220px at 30% 0%, rgba(56, 189, 248, 0.12), transparent 60%);
}

/* 样式：.header */
.header {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 44px;
}

/* 样式：.avatar */
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(20, 32, 29, 0.08);
  border: 1px solid var(--cp-border-light);
  flex: 0 0 auto;
}

/* 样式：.avatar.placeholder */
.avatar.placeholder {
  background: rgba(15, 118, 110, 0.10);
}

/* 样式：.meta */
.meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 样式：.name */
.name {
  font-size: 14px;
  font-weight: 600;
  color: var(--cp-text);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.email */
.email {
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.bio */
.bio {
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.35;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 3;
}

/* 样式：.muted */
.muted {
  color: transparent;
}
</style>
