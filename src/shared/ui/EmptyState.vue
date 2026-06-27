<script setup lang="ts">
/**
 * @fileoverview 空状态组件（EmptyState.vue）。
 * @description 提供"图标 + 标题 + 描述 + 可选操作"统一布局；调用方通过 slot 注入操作。
 */

defineOptions({ name: "EmptyState" });

withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: "",
    description: "",
  },
);
</script>

<template>
  <!-- 组件：EmptyState｜职责：空状态统一布局（图标 / 标题 / 描述 / 操作） -->
  <!-- 区块：<div> .cp-empty -->
  <div class="cp-empty">
    <!-- 图标 -->
    <div v-if="$slots.icon" class="cp-empty__icon">
      <slot name="icon" />
    </div>
    <!-- 标题 -->
    <div v-if="title && title.trim().length > 0" class="cp-empty__title">{{ title }}</div>
    <!-- 描述 -->
    <div v-if="description && description.trim().length > 0" class="cp-empty__desc">
      {{ description }}
    </div>
    <!-- 操作 -->
    <div v-if="$slots.action" class="cp-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：EmptyState｜布局：垂直居中堆叠（图标 / 标题 / 描述 / 操作） */
.cp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  color: var(--cp-text-muted);
  text-align: center;
}

/* 图标容器 */
.cp-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 999px;
  background: var(--cp-panel-muted);
  border: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
}

/* 标题 */
.cp-empty__title {
  font-family: var(--cp-font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--cp-text);
}

/* 描述 */
.cp-empty__desc {
  font-size: 12px;
  color: var(--cp-text-muted);
  max-width: 360px;
  line-height: 1.5;
}

/* 操作区 */
.cp-empty__action {
  margin-top: 4px;
}
</style>
