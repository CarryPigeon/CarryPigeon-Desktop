<script setup lang="ts">
/**
 * @fileoverview MonoTag.vue
 * @description Monospace tag for sockets/ids with optional copy.
 */

import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    value: string;
    title?: string;
    copyable?: boolean;
  }>(),
  {
    title: "",
    copyable: false,
  },
);

const display = computed(() => props.value.trim());

/**
 * handleCopy 方法说明。
 * @returns 返回值说明。
 */
async function handleCopy() {
  if (!props.copyable) return;
  const text = display.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // best-effort copy
  }
}
</script>

<template>
  <!-- 组件：MonoTag｜职责：mono 铭牌（可选复制） -->
  <!-- 区块：<button> -->
  <button
    class="mono-tag"
    :class="{ copyable: props.copyable }"
    type="button"
    :title="props.title || display"
    @click="handleCopy"
  >
    <span class="mono-tag__text">{{ display || "—" }}</span>
    <span v-if="props.copyable" class="mono-tag__hint" aria-hidden="true">⧉</span>
  </button>
</template>

<style scoped lang="scss">
.mono-tag {
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: default;
}

.mono-tag.copyable {
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
    border-color: rgba(56, 189, 248, 0.30);
  }
}

.mono-tag__text {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.mono-tag__hint {
  opacity: 0.65;
  font-family: var(--cp-font-mono);
  font-size: 12px;
}
</style>

