<script setup lang="ts">
/**
 * @fileoverview DomainSelector.vue
 * @description chat｜组件：DomainSelector。
 */

import { computed } from "vue";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  modelValue: string;
  options: Array<{ id: string; label: string; colorVar: string }>;
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
  (e: "toggleExpand"): void;
}>();

const activeOption = computed(() => props.options.find((o) => o.id === props.modelValue));

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
  <div v-if="props.collapsed" class="cp-domain-collapsed" role="button" :tabindex="0" @click="$emit('toggleExpand')" @keydown.enter="$emit('toggleExpand')">
    <span class="cp-domain__dot" :style="activeOption ? { background: `var(${activeOption.colorVar})` } : {}" aria-hidden="true"></span>
    <span class="cp-domain-collapsed__label">{{ activeOption?.label ?? '' }}</span>
    <span class="cp-domain-collapsed__arrow"><AppIcon name="chevron-down" /></span>
  </div>
  <!-- 区块：<div> .cp-domain-selector (展开模式) -->
  <div
    v-else
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
/* 样式：DomainSelector｜规格：设置页胶囊控件（静态描边，hover/激活只变底色/描边/字色） */
/* 选择器：`.cp-domain-selector` —— domain 选项胶囊的容器。 */
.cp-domain-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 选择器：`.cp-domain` —— domain 选项按钮（未激活）。 */
.cp-domain {
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  font-size: 12.5px;
  line-height: 1.4;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

/* 选择器：`.cp-domain:hover` —— hover 只变底色/描边/字色，不做位移。 */
.cp-domain:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
  color: var(--cp-text);
}

/* 选择器：`.cp-domain[data-active="true"]` —— 激活态 domain 选中样式。 */
.cp-domain[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* 选择器：`.cp-domain__dot` —— 左侧颜色圆点（domain 色）。 */
.cp-domain__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

/* 选择器：`.cp-domain__label` —— domain 文案（不换行）。 */
.cp-domain__label {
  white-space: nowrap;
}

/* 折叠态选择器：与工具栏胶囊按钮同高 */
.cp-domain-collapsed {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 999px;
  cursor: pointer;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text);
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}
.cp-domain-collapsed:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}
.cp-domain-collapsed__label {
  white-space: nowrap;
}
.cp-domain-collapsed__arrow {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-left: 2px;
}
</style>
