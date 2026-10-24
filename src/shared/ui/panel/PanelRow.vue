<script setup lang="ts">
/**
 * @fileoverview PanelRow.vue
 * @description shared/ui｜展示组件：统一设置行（左侧标签/说明 + 右侧控件）。
 *
 * 说明：根节点透传外部属性，调用方可直接挂 `data-settings-item` 等锚点，
 * 搜索结果跳转与高亮因此无需额外包装层。
 */

defineOptions({ name: "PanelRow", inheritAttrs: true });

withDefaults(
  defineProps<{
    /** 行标签（必填）。 */
    label: string;
    /** 行说明（可选；也可用 description 插槽渲染富文本/状态）。 */
    description?: string;
    /** 布局：inline = 左文右控件；stack = 上下堆叠（宽控件/列表类内容）。 */
    layout?: "inline" | "stack";
  }>(),
  {
    description: "",
    layout: "inline",
  },
);
</script>

<template>
  <!-- 组件：PanelRow｜职责：设置行（标签 + 说明 + 控件槽） -->
  <div class="cp-panel-row" :data-layout="layout">
    <!-- 区块：文案区｜用途：行标签与说明 -->
    <div class="cp-panel-row__text">
      <div class="cp-panel-row__label">{{ label }}</div>
      <div v-if="description || $slots.description" class="cp-panel-row__desc">
        <slot name="description">{{ description }}</slot>
      </div>
    </div>

    <!-- 区块：控件区｜用途：开关 / 分段控件 / 按钮 / 自定义控件 -->
    <div v-if="$slots.control" class="cp-panel-row__control">
      <slot name="control" />
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：PanelRow｜规格：cp-list-row + hover 底色；工作台分组内不画相邻分隔线 */
.cp-panel-row {
  @include cp-list-row;

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  scroll-margin-top: 16px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

/* 行 hover 只变底色，不做位移 */
.cp-panel-row:hover {
  background: var(--cp-hover-bg);
}

.cp-panel-row__text {
  min-width: 0;
}

.cp-panel-row__label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--cp-text);
}

.cp-panel-row__desc {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-panel-row__control {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}

/* 堆叠布局：自定义控件/列表独占整行宽度 */
.cp-panel-row[data-layout="stack"] {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}

.cp-panel-row[data-layout="stack"] .cp-panel-row__control {
  justify-content: flex-start;
  width: 100%;
}

/* 窄窗口：所有行统一改为上下堆叠，避免控件被挤压 */
@media (max-width: 640px) {
  .cp-panel-row {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  .cp-panel-row__control {
    justify-content: flex-start;
  }
}
</style>
