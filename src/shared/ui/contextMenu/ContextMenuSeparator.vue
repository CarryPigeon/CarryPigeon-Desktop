<script setup lang="ts">
/**
 * @fileoverview ContextMenuSeparator.vue
 * @description shared/ui｜菜单分组分隔线。
 */

defineOptions({ name: "ContextMenuSeparator" });
</script>

<template>
  <!-- 组件：ContextMenuSeparator｜职责：菜单分组分隔线 -->
  <div class="cp-menu__separator" role="separator"></div>
</template>

<style scoped lang="scss">
/* 样式：ContextMenuSeparator｜1px 分隔线 */
.cp-menu__separator {
  height: 1px;
  margin: 4px 8px;
  background: var(--cp-border);
}
</style>
