<script setup lang="ts">
/**
 * @fileoverview ContextMenuLabel.vue
 * @description shared/ui｜菜单分组标签（如「通知级别」「静音时长」）。
 */

defineOptions({ name: "ContextMenuLabel" });
</script>

<template>
  <!-- 组件：ContextMenuLabel｜职责：菜单分组标签 -->
  <div class="cp-menu__label" role="presentation">
    <slot />
  </div>
</template>

<style scoped lang="scss">
/* 样式：ContextMenuLabel｜分组标签（小号大写字距） */
.cp-menu__label {
  padding: 6px 12px 2px;
  color: var(--cp-text-light);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
</style>
