<script setup lang="ts">
/**
 * @fileoverview DomainSelector.vue
 * @description Domain selector for ComposerHost.
 */

const props = defineProps<{
  modelValue: string;
  options: Array<{ id: string; label: string; colorVar: string }>;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: string): void;
}>();

/**
 * Pick a domain option and update v-model.
 *
 * @param id - Domain id.
 * @returns void
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
/* DomainSelector styles */
/* Selector: `.cp-domain-selector` — wrapper for domain option pills. */
.cp-domain-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Selector: `.cp-domain` — domain option button (inactive). */
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

/* Selector: `.cp-domain:hover` — hover lift + highlight border. */
.cp-domain:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Selector: `.cp-domain[data-active="true"]` — active domain selection. */
.cp-domain[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* Selector: `.cp-domain__dot` — left color dot (domain color). */
.cp-domain__dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-border) 70%, transparent);
}

/* Selector: `.cp-domain__label` — domain label (no wrap). */
.cp-domain__label {
  white-space: nowrap;
}
</style>
