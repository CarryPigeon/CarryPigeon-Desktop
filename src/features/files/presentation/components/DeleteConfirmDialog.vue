<script setup lang="ts">
/**
 * @fileoverview DeleteConfirmDialog.vue
 * @description files｜删除确认弹窗。
 */

import { useI18n } from "vue-i18n";

const props = defineProps<{
  visible: boolean;
  count: number;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="cp-deleteOverlay" @click.self="emit('cancel')">
      <div class="cp-deleteDialog">
        <div class="cp-deleteDialog__icon">🗑️</div>
        <div class="cp-deleteDialog__title">{{ t("file_delete_confirm_title") }}</div>
        <div class="cp-deleteDialog__msg">
          {{ t("file_delete_confirm_message", { count }) }}
        </div>
        <div class="cp-deleteDialog__actions">
          <button class="cp-deleteDialog__btn" type="button" @click="emit('cancel')">{{ t("cancel") }}</button>
          <button class="cp-deleteDialog__btn cp-deleteDialog__btn--danger" type="button" @click="emit('confirm')">
            {{ t("confirm") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.cp-deleteOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.cp-deleteDialog {
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 16px;
  padding: 24px;
  max-width: 380px;
  width: 90%;
  text-align: center;
  box-shadow: var(--cp-shadow-strong);
}

.cp-deleteDialog__icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.cp-deleteDialog__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--cp-text);
  margin-bottom: 8px;
}

.cp-deleteDialog__msg {
  font-size: 13px;
  color: var(--cp-text-muted);
  margin-bottom: 20px;
  line-height: 1.5;
}

.cp-deleteDialog__actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.cp-deleteDialog__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 20px;
  font-size: 13px;
  cursor: pointer;
  transition: border-color var(--cp-fast) var(--cp-ease);
}

.cp-deleteDialog__btn:hover {
  border-color: var(--cp-highlight-border);
}

.cp-deleteDialog__btn--danger {
  color: #fff;
  background: #e74c3c;
  border-color: #e74c3c;
}

.cp-deleteDialog__btn--danger:hover {
  background: #c0392b;
  border-color: #c0392b;
}
</style>
