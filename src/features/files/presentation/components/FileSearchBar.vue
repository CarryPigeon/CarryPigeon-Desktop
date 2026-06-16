<script setup lang="ts">
/**
 * @fileoverview FileSearchBar.vue
 * @description files｜文件列表搜索栏。
 */

import { useI18n } from "vue-i18n";
import { debounce } from "@/shared/utils/rateLimit";
import type { FileListQuery } from "../../domain/contracts";

const emit = defineEmits<{
  (e: "search", query: FileListQuery): void;
}>();

const { t } = useI18n();

const handleInput = debounce(function (event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("search", { search: value || undefined });
}, 300);

function handleTypeSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit("search", { mimePrefix: value || undefined });
}
</script>

<template>
  <div class="cp-fileSearch">
    <input
      class="cp-fileSearch__input"
      type="text"
      :placeholder="t('file_search_placeholder')"
      @input="handleInput"
    />
    <select class="cp-fileSearch__select" @change="handleTypeSelect">
      <option value="">{{ t("file_type") }}: All</option>
      <option value="image/">{{ t("file_type") }}: Image</option>
      <option value="text/">{{ t("file_type") }}: Text</option>
      <option value="application/pdf">PDF</option>
      <option value="application/zip">Archive</option>
    </select>
  </div>
</template>

<style scoped lang="scss">
.cp-fileSearch {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.cp-fileSearch__input {
  flex: 1;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
}

.cp-fileSearch__select {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
  cursor: pointer;
}
</style>
