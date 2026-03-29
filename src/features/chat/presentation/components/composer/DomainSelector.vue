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

function optionId(index: number): string {
  return `cp-domain-option-${index}`;
}

function activeOptionId(): string | undefined {
  const idx = props.options.findIndex((option) => option.id === props.modelValue);
  if (idx < 0) return undefined;
  return optionId(idx);
}

/**
 * 选择一个 domain 并更新 v-model。
 *
 * @param id - domain id。
 * @returns 无返回值。
 */
function handlePick(id: string): void {
  emit("update:modelValue", id);
}

function handleOptionKeydown(e: KeyboardEvent, index: number): void {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  const count = props.options.length;
  if (count <= 0) return;

  e.preventDefault();
  const step = e.key === "ArrowRight" ? 1 : -1;
  const next = (index + step + count) % count;
  const option = props.options[next];
  if (!option) return;

  emit("update:modelValue", option.id);
  requestAnimationFrame(() => {
    document.getElementById(optionId(next))?.focus();
  });
}
</script>

<template>
  <!-- 组件：DomainSelector｜职责：选择发送 domain -->
  <!-- 区块：<div> .cp-domain-selector -->
  <div
    class="cp-domain-selector"
    role="listbox"
    aria-label="domain"
    aria-orientation="horizontal"
    :aria-activedescendant="activeOptionId()"
  >
    <button
      v-for="(d, idx) in props.options"
      :id="optionId(idx)"
      :key="d.id"
      class="cp-domain"
      type="button"
      :data-active="props.modelValue === d.id"
      role="option"
      :aria-selected="props.modelValue === d.id"
      @click="handlePick(d.id)"
      @keydown="handleOptionKeydown($event, idx)"
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
