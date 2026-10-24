<script setup lang="ts">
/**
 * @fileoverview GovernancePageShell.vue
 * @description chat/room-governance｜presentation component：治理子页面共享页面骨架。
 */

import PageHeader from "@/shared/ui/PageHeader.vue";

defineProps<{
  channelName: string;
  subtitle: string;
  isLoading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <!-- 组件：GovernancePageShell｜职责：治理子页面统一骨架（PageHeader + 状态/内容面板） -->
  <main class="cp-governancePage">
    <!-- 区块：页面头部｜用途：返回 + 频道名 + 治理类别 + 右侧筛选/操作（保留原 back 事件与 testid） -->
    <PageHeader
      :title="channelName"
      :subtitle="subtitle"
      back
      back-test-id="governance-back"
      @back="emit('back')"
    >
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </PageHeader>

    <!-- 区块：加载/错误状态｜用途：先于内容渲染（类名保持兼容既有测试） -->
    <div v-if="isLoading" class="cp-governancePage__state">
      <slot name="loading">Loading</slot>
    </div>
    <div v-else-if="errorMessage" class="cp-governancePage__state cp-governancePage__state--error">
      {{ errorMessage }}
    </div>
    <!-- 区块：内容面板｜用途：一级玻璃面板承载治理列表 -->
    <section v-else class="cp-governancePage__body">
      <slot />
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 样式：GovernancePageShell｜规格：工作台骨架 + PageHeader + 透明内容区 */
.cp-governancePage {
  @include cp-workspace;

  overflow: hidden;
}

.cp-governancePage__state {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}

.cp-governancePage__state--error {
  color: var(--cp-danger);
}

.cp-governancePage__body {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
