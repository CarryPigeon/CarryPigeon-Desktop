<script setup lang="ts">
/**
 * @fileoverview FileToolbar.vue
 * @description files｜文件工具栏：排序控件、批量操作栏。
 */

import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
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
  <!-- 组件：FileToolbar｜职责：排序字段 + 排序方向 + 批量操作 -->
  <div class="cp-fileToolbar">
    <div class="cp-fileToolbar__sort">
      <span class="cp-fileToolbar__label">{{ t("file_sort_label") }}:</span>
      <span class="cp-fileToolbar__field">
        <select class="cp-fileToolbar__select" :value="sortBy" @change="handleSortFieldChange">
          <option v-for="field in sortFields" :key="field.value" :value="field.value">
            {{ field.label }}
          </option>
        </select>
        <AppIcon class="cp-fileToolbar__chevron" name="chevron-down" :size="13" />
      </span>
      <button
        class="cp-fileToolbar__orderBtn"
        type="button"
        :title="sortOrder === 'asc' ? t('file_sort_asc') : t('file_sort_desc')"
        :aria-label="sortOrder === 'asc' ? t('file_sort_asc') : t('file_sort_desc')"
        @click="handleSortOrderToggle"
      >
        <AppIcon :name="sortOrder === 'asc' ? 'sort-asc' : 'sort-desc'" :size="13" :stroke-width="2" />
      </button>
    </div>

    <!-- 批量操作：选中后出现，胶囊按钮与高亮底一致 -->
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
/* 样式：文件工具栏｜规格：字段化排序控件 + highlight 选中态批量条 */
.cp-fileToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.cp-fileToolbar__sort {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-fileToolbar__label {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 排序字段：与搜索字段同一套 field token */
.cp-fileToolbar__field {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 28px 0 12px;
  border: 1px solid var(--cp-field-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-field-bg);
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.cp-fileToolbar__field:hover {
  border-color: var(--cp-field-border-hover);
  background: var(--cp-field-bg-hover);
}

.cp-fileToolbar__field:focus-within {
  border-color: var(--cp-focus-border);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
}

.cp-fileToolbar__select {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font-family: var(--cp-font-body);
  font-size: 12.5px;
  line-height: 1.4;
  outline: none;
  appearance: none;
  cursor: pointer;
  padding: 0;
}

.cp-fileToolbar__select:focus-visible {
  box-shadow: none;
}

.cp-fileToolbar__chevron {
  position: absolute;
  right: 9px;
  pointer-events: none;
  color: var(--cp-text-muted);
}

/* 排序方向：统一图标按钮规格 */
.cp-fileToolbar__orderBtn {
  @include cp-icon-button;
}

.cp-fileToolbar__batch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 3px 5px 3px 12px;
  border: 1px solid var(--cp-highlight-border);
  border-radius: 999px;
  background: var(--cp-highlight-bg);
}

.cp-fileToolbar__count {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text);
  white-space: nowrap;
}

.cp-fileToolbar__batchBtn {
  @include cp-pill-button;

  min-height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}

.cp-fileToolbar__batchBtn--danger {
  @include cp-pill-button(danger);

  min-height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}

/* 响应式：窄窗口批量条换行占满 */
@media (max-width: 640px) {
  .cp-fileToolbar__batch {
    width: 100%;
    flex-wrap: wrap;
    border-radius: var(--cp-radius-control);
    padding: 6px 8px;
  }
}
</style>
