<script setup lang="ts">
/**
 * @fileoverview FileToolbar.vue
 * @description files｜文件工具栏：排序下拉、批量操作栏。
 */

import { useI18n } from "vue-i18n";
import type { FileSortField, SortOrder } from "../../domain/contracts";

const props = defineProps<{
  sortBy: FileSortField;
  sortOrder: SortOrder;
  selectedCount: number;
}>();

const emit = defineEmits<{
  (e: "update:sortBy", v: FileSortField): void;
  (e: "update:sortOrder", v: SortOrder): void;
  (e: "batchDelete"): void;
  (e: "clearSelection"): void;
}>();

const { t } = useI18n();

const sortFields: { value: FileSortField; label: string }[] = [
  { value: "uploadedAt", label: t("file_sort_date") },
  { value: "filename", label: t("file_sort_filename") },
  { value: "sizeBytes", label: t("file_sort_size") },
];

function handleSortFieldChange(event: Event): void {
  emit("update:sortBy", (event.target as HTMLSelectElement).value as FileSortField);
}

function handleSortOrderToggle(): void {
  emit("update:sortOrder", props.sortOrder === "asc" ? "desc" : "asc");
}
</script>

<template>
  <div class="cp-fileToolbar">
    <div class="cp-fileToolbar__sort">
      <span class="cp-fileToolbar__label">{{ t("file_sort_label") }}:</span>
      <select class="cp-fileToolbar__select" :value="sortBy" @change="handleSortFieldChange">
        <option v-for="field in sortFields" :key="field.value" :value="field.value">
          {{ field.label }}
        </option>
      </select>
      <button
        class="cp-fileToolbar__orderBtn"
        type="button"
        :title="sortOrder === 'asc' ? t('file_sort_asc') : t('file_sort_desc')"
        @click="handleSortOrderToggle"
      >
        {{ sortOrder === "asc" ? "↑" : "↓" }}
      </button>
    </div>

    <div v-if="selectedCount > 0" class="cp-fileToolbar__batch">
      <span class="cp-fileToolbar__count">{{ t("file_selected_count", { count: selectedCount }) }}</span>
      <button class="cp-fileToolbar__batchBtn cp-fileToolbar__batchBtn--danger" type="button" @click="emit('batchDelete')">
        {{ t("file_batch_delete") }}
      </button>
      <button class="cp-fileToolbar__batchBtn" type="button" @click="emit('clearSelection')">
        {{ t("file_cancel_selection") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-fileToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cp-fileToolbar__sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-fileToolbar__label {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-fileToolbar__select {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  outline: none;
  cursor: pointer;
}

.cp-fileToolbar__orderBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  line-height: 1;
}

.cp-fileToolbar__orderBtn:hover {
  border-color: var(--cp-highlight-border);
}

.cp-fileToolbar__batch {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 999px;
}

.cp-fileToolbar__count {
  font-size: 12px;
  color: var(--cp-text);
  font-weight: 500;
}

.cp-fileToolbar__batchBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
}

.cp-fileToolbar__batchBtn:hover {
  border-color: var(--cp-highlight-border);
}

.cp-fileToolbar__batchBtn--danger {
  color: #e74c3c;
  border-color: #e74c3c;
}

.cp-fileToolbar__batchBtn--danger:hover {
  background: #e74c3c10;
}
</style>
