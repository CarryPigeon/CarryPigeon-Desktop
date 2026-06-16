<script setup lang="ts">
/**
 * @fileoverview SkeletonMessageList.vue
 * @description 消息列表加载骨架 — 模拟 5-8 条消息的占位布局。
 */

import SkeletonBlock from "./SkeletonBlock.vue";

withDefaults(
  defineProps<{
    /** 骨架消息行数（默认 6） */
    rows?: number;
  }>(),
  {
    rows: 6,
  },
);
</script>

<template>
  <!-- 组件：SkeletonMessageList｜职责：消息列表加载骨架 -->
  <div class="cp-skeletonMsgs" aria-hidden="true">
    <div
      v-for="i in rows"
      :key="i"
      class="cp-skeletonMsg"
      :class="{ 'cp-skeletonMsg--groupStart': i % 3 === 1 }"
    >
      <!-- 头像占位（仅 group start 可见） -->
      <div v-if="i % 3 === 1" class="cp-skeletonMsg__avatar">
        <SkeletonBlock variant="avatar" />
      </div>
      <div v-else class="cp-skeletonMsg__avatar" />

      <!-- 内容区 -->
      <div class="cp-skeletonMsg__body">
        <div v-if="i % 3 === 1" class="cp-skeletonMsg__meta">
          <SkeletonBlock variant="title" width="80px" />
          <SkeletonBlock variant="text" width="60px" />
        </div>
        <SkeletonBlock variant="text" :width="i % 2 === 0 ? '70%' : '55%'" />
        <SkeletonBlock v-if="i % 3 !== 0" variant="text" :width="i % 2 === 0 ? '40%' : '85%'" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-skeletonMsgs {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.cp-skeletonMsg {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.cp-skeletonMsg--groupStart {
  margin-top: 8px;
}

.cp-skeletonMsg__avatar {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-skeletonMsg__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-skeletonMsg__meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 2px;
}
</style>
