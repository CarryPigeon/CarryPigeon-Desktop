<script setup lang="ts">
/**
 * @fileoverview PanelGroup.vue
 * @description shared/ui｜展示组件：统一分组卡（组标题 + 行容器 + 脚注）。
 *
 * 职责：把设置页的分组卡视觉语言（1px 边框 + panel 底色 + 16px 圆角 + 组头/行/脚注分隔）
 * 提供给全应用复用；只做展示，不含业务/i18n 依赖。
 */

defineOptions({ name: "PanelGroup", inheritAttrs: true });

withDefaults(
  defineProps<{
    /** 分组标题（可选；无标题时只作为外层卡片容器）。 */
    title?: string;
    /** 分组说明（可选）。 */
    description?: string;
    /** 内容区是否追加统一内边距（用于非 PanelRow 的自定义内容）。 */
    padded?: boolean;
    /** 组标题是否使用大写/字距样式（插件 id 等需要保持原始大小写的场景传 false）。 */
    uppercase?: boolean;
  }>(),
  {
    title: "",
    description: "",
    padded: false,
    uppercase: true,
  },
);
</script>

<template>
  <!-- 组件：PanelGroup｜职责：分组卡（组头 + 行 + 脚注） -->
  <section class="cp-panel-group">
    <!-- 区块：组头｜用途：分组标题 / 说明 / 右侧操作 -->
    <header v-if="title || description || $slots.headAction" class="cp-panel-group__head">
      <div class="cp-panel-group__heading">
        <div v-if="title" class="cp-panel-group__title" :data-uppercase="uppercase">{{ title }}</div>
        <div v-if="description" class="cp-panel-group__desc">{{ description }}</div>
      </div>
      <div v-if="$slots.headAction" class="cp-panel-group__headAction">
        <slot name="headAction" />
      </div>
    </header>

    <!-- 区块：内容区｜用途：承载 PanelRow 或自定义内容 -->
    <div class="cp-panel-group__body" :class="{ 'cp-panel-group__body--padded': padded }">
      <slot />
    </div>

    <!-- 区块：脚注｜用途：分组级提示文案 -->
    <footer v-if="$slots.footer" class="cp-panel-group__foot">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped lang="scss">
/* 样式：PanelGroup｜规格：cp-card + 无分隔线的工作台分组（靠间距与底色区分） */
.cp-panel-group {
  @include cp-card;

  overflow: hidden;
}

/* 分组之间保持固定节奏 */
.cp-panel-group + .cp-panel-group {
  margin-top: 10px;
}

.cp-panel-group__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 4px;
}

.cp-panel-group__heading {
  min-width: 0;
}

.cp-panel-group__title {
  @include cp-section-label;
}

.cp-panel-group__title[data-uppercase="false"] {
  font-family: var(--cp-font-mono);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.02em;
  text-transform: none;
}

.cp-panel-group__desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-panel-group__headAction {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-panel-group__body--padded {
  padding: 10px 12px;
}

.cp-panel-group__foot {
  padding: 8px 12px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}
</style>
