<script setup lang="ts">
/**
 * @fileoverview SectionHead.vue
 * @description shared/ui｜展示组件：面板内分区头（图标瓦片 + 标题 + 副标题 + 右侧操作）。
 *
 * 规格来源：设置页 `.cp-settings__sectionHead`（32px 图标瓦片、20px 分区标题、13px 副标题）。
 * 边界：只负责展示；间距可通过调用方设置 `--cp-section-head-gap` 覆盖。
 */

import AppIcon from "@/shared/ui/AppIcon.vue";

defineOptions({ name: "SectionHead" });

withDefaults(
  defineProps<{
    /** 图标名（AppIcon/Lucide sprite 的 key）；为空时不渲染图标瓦片。 */
    icon?: string;
    /** 分区标题。 */
    title: string;
    /** 分区副标题（可选）。 */
    subtitle?: string;
  }>(),
  {
    icon: "",
    subtitle: "",
  },
);
</script>

<template>
  <!-- 组件：SectionHead｜职责：面板内分区头 -->
  <header class="cp-section-head">
    <div v-if="icon" class="cp-section-head__icon">
      <AppIcon :name="icon" :size="18" />
    </div>
    <div class="cp-section-head__heading">
      <div class="cp-section-head__title">{{ title }}</div>
      <div v-if="subtitle" class="cp-section-head__sub">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.actions" class="cp-section-head__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 样式：SectionHead｜规格：图标瓦片 32px + 分区标题 20px */
.cp-section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: var(--cp-section-head-gap, 20px);
}

.cp-section-head__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
}

.cp-section-head__heading {
  flex: 1 1 auto;
  min-width: 0;
}

.cp-section-head__title {
  @include cp-section-title;
}

.cp-section-head__sub {
  margin-top: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-section-head__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
