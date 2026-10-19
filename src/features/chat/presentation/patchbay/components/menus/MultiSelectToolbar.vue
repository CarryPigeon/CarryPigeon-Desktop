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
/* 样式：MultiSelectToolbar｜规格：消息区工具条（计数 + 胶囊动作按钮，无位移 hover） */
.cp-multiSelectToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background: var(--cp-panel-muted);
  position: sticky;
  top: 0;
  z-index: 10;
}

.cp-multiSelectToolbar__count {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

.cp-multiSelectToolbar__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

/* 批量动作：统一胶囊按钮 */
.cp-multiSelectToolbar__btn {
  @include cp-pill-button;

  min-height: 26px;
  padding: 0 10px;
  font-size: 12px;
}

.cp-multiSelectToolbar__btn--cancel {
  color: var(--cp-text-muted);
}

.cp-multiSelectToolbar__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
