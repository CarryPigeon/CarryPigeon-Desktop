<script setup lang="ts">
/**
 * @fileoverview DomainSelector.vue
 * @description chat｜组件：DomainSelector。
 */

const props = defineProps<{
  modelValue: string;
  options: Array<{ id: string; label: string; colorVar: string }>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

/**
 * 选择一个 domain 并更新 v-model。
 *
 * @param id - domain id。
 * @returns 无返回值。
 */
function handlePick(id: string): void {
  emit("update:modelValue", id);
}
</script>

<template>
  <!-- 组件：DomainSelector｜职责：选择发送 domain -->
  <!-- 区块：<div> .cp-domain-selector -->
  <div class="cp-domain-selector" role="listbox" aria-label="domain">
    <button
      v-for="d in props.options"
      :key="d.id"
      class="cp-domain"
      type="button"
      :data-active="props.modelValue === d.id"
      @click="handlePick(d.id)"
    >
      <span class="cp-domain__dot" :style="{ background: `var(${d.colorVar})` }" aria-hidden="true"></span>
      <span class="cp-domain__label">{{ d.label }}</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
/* 样式：DomainSelector */
/* 选择器：`.cp-domain-selector` —— domain 选项胶囊的容器。 */
.cp-domain-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 选择器：`.cp-domain` —— domain 选项按钮（未激活）。 */
.cp-domain {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-domain:hover` —— hover 抬升 + 强调边框。 */
.cp-domain:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* 选择器：`.cp-domain[data-active="true"]` —— 激活态 domain 选中样式。 */
.cp-domain[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* 选择器：`.cp-domain__dot` —— 左侧颜色圆点（domain 色）。 */
.cp-domain__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

/* 选择器：`.cp-domain__label` —— domain 文案（不换行）。 */
.cp-domain__label {
  white-space: nowrap;
}
</style>
