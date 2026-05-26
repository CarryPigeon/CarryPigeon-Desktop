<script setup lang="ts">
/**
 * @fileoverview MultiSelectToolbar.vue
 * @description chat｜组件：MultiSelectToolbar。
 */

import { useI18n } from "vue-i18n";

const props = defineProps<{
  selectedCount: number;
}>();

const emit = defineEmits<{
  (e: "cancel"): void;
  (e: "forward-merged"): void;
  (e: "forward-separate"): void;
  (e: "delete"): void;
  (e: "bookmark"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="cp-multiSelectToolbar">
    <span class="cp-multiSelectToolbar__count">
      {{ t("selected_count", { count: props.selectedCount }) }}
    </span>
    <div class="cp-multiSelectToolbar__actions">
      <button
        v-if="props.selectedCount > 0"
        class="cp-multiSelectToolbar__btn"
        @click="emit('forward-merged')"
      >
        {{ t("forward_merged") }} ({{ props.selectedCount }})
      </button>
      <button
        v-if="props.selectedCount > 0"
        class="cp-multiSelectToolbar__btn"
        @click="emit('forward-separate')"
      >
        {{ t("forward_separate") }} ({{ props.selectedCount }})
      </button>
      <button
        v-if="props.selectedCount > 0"
        class="cp-multiSelectToolbar__btn cp-multiSelectToolbar__btn--danger"
        @click="emit('delete')"
      >
        {{ t("delete") }} ({{ props.selectedCount }})
      </button>
      <button
        v-if="props.selectedCount > 0"
        class="cp-multiSelectToolbar__btn"
        @click="emit('bookmark')"
      >
        {{ t("bookmark") }} ({{ props.selectedCount }})
      </button>
      <button class="cp-multiSelectToolbar__btn cp-multiSelectToolbar__btn--cancel" @click="emit('cancel')">
        {{ t("cancel") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-multiSelectToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--cp-panel, #1e1e2e);
  border-bottom: 1px solid var(--cp-border, #313244);
  position: sticky;
  top: 0;
  z-index: 10;
}
.cp-multiSelectToolbar__count {
  font-size: 13px;
  color: var(--cp-text-secondary, #a6adc8);
}
.cp-multiSelectToolbar__actions {
  display: flex;
  gap: 8px;
}
.cp-multiSelectToolbar__btn {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--cp-border, #313244);
  background: transparent;
  color: var(--cp-text, #cdd6f4);
  font-size: 12px;
  cursor: pointer;
}
.cp-multiSelectToolbar__btn--danger {
  color: var(--cp-danger, #e34);
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
}
.cp-multiSelectToolbar__btn--cancel {
  color: var(--cp-text-secondary, #a6adc8);
}
.cp-multiSelectToolbar__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
