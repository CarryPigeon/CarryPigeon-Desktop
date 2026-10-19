<script setup lang="ts">
/**
 * @fileoverview FileSearchBar.vue
 * @description files｜文件列表搜索栏（增强版：类型/上传者/日期筛选）。
 */

import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { debounce } from "@/shared/utils/rateLimit";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { getFilesCapabilities } from "../../api";
import { readActiveFileServerSocket } from "../../composition/activeServerSocket";
import { readAuthToken } from "@/shared/utils/localState";
import type { FileListQuery, UploaderInfo } from "../../domain/contracts";

const emit = defineEmits<{
  (e: "search", query: FileListQuery): void;
}>();

const { t } = useI18n();

const capabilities = getFilesCapabilities();
const uploaders = ref<UploaderInfo[]>([]);

const filters = ref({
  uploaderId: "",
  dateFrom: "",
  dateTo: "",
});

onMounted(async () => {
  const socket = readActiveFileServerSocket();
  if (!socket) return;
  const token = readAuthToken(socket) || "";
  try {
    uploaders.value = await capabilities.listUploaders(socket, token);
  } catch {
    // Uploader list is optional — silently degrade
  }
});

const handleInput = debounce(function (event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("search", { search: value || undefined });
}, 300);

function handleTypeSelect(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit("search", { mimePrefix: value || undefined });
}

function handleUploaderChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  filters.value.uploaderId = value;
  emitSearch();
}

function handleDateChange(): void {
  emitSearch();
}

function emitSearch(): void {
  const q: FileListQuery = {};
  if (filters.value.uploaderId) q.uploaderId = filters.value.uploaderId;
  if (filters.value.dateFrom) q.dateFrom = filters.value.dateFrom;
  if (filters.value.dateTo) q.dateTo = filters.value.dateTo;
  emit("search", q);
}
</script>

<template>
  <!-- 组件：FileSearchBar｜职责：文件搜索与筛选（字段化控件，与设置页输入规格一致） -->
  <div class="cp-fileSearch">
    <label class="cp-fileSearch__field cp-fileSearch__field--search">
      <AppIcon class="cp-fileSearch__icon" name="search" :size="15" />
      <input
        class="cp-fileSearch__input"
        type="text"
        role="searchbox"
        :aria-label="t('file_search_placeholder')"
        :placeholder="t('file_search_placeholder')"
        @input="handleInput"
      />
    </label>

    <span class="cp-fileSearch__field cp-fileSearch__field--select">
      <select class="cp-fileSearch__select" :aria-label="t('file_type')" @change="handleTypeSelect">
        <option value="">{{ t("file_type") }}: {{ t("all") }}</option>
        <option value="image/">{{ t("file_type") }}: Image</option>
        <option value="text/">{{ t("file_type") }}: Text</option>
        <option value="application/pdf">PDF</option>
        <option value="application/zip">Archive</option>
        <option value="video/">Video</option>
        <option value="audio/">Audio</option>
      </select>
      <AppIcon class="cp-fileSearch__chevron" name="chevron-down" :size="14" />
    </span>

    <span v-if="uploaders.length > 0" class="cp-fileSearch__field cp-fileSearch__field--select">
      <select
        class="cp-fileSearch__select"
        :aria-label="t('file_uploader_filter')"
        :value="filters.uploaderId"
        @change="handleUploaderChange"
      >
        <option value="">{{ t("file_uploader_filter") }}: {{ t("all") }}</option>
        <option v-for="u in uploaders" :key="u.id" :value="u.id">{{ u.name }}</option>
      </select>
      <AppIcon class="cp-fileSearch__chevron" name="chevron-down" :size="14" />
    </span>

    <label class="cp-fileSearch__field cp-fileSearch__field--date">
      <AppIcon class="cp-fileSearch__icon" name="calendar" :size="14" />
      <input
        class="cp-fileSearch__date"
        type="date"
        :aria-label="t('file_date_filter')"
        :title="t('file_date_filter')"
        :value="filters.dateFrom"
        @change="handleDateChange"
      />
    </label>

    <label class="cp-fileSearch__field cp-fileSearch__field--date">
      <AppIcon class="cp-fileSearch__icon" name="calendar" :size="14" />
      <input
        class="cp-fileSearch__date"
        type="date"
        :aria-label="t('file_date_filter')"
        :title="t('file_date_filter')"
        :value="filters.dateTo"
        @change="handleDateChange"
      />
    </label>
  </div>
</template>

<style scoped lang="scss">
/* 样式：文件搜索栏｜规格：字段化控件（38px 高、12px 圆角、field token、focus ring） */
.cp-fileSearch {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* 字段容器：统一输入/下拉/日期的外观，focus 由内部控件触发 */
.cp-fileSearch__field {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--cp-field-height);
  padding: 0 12px;
  border: 1px solid var(--cp-field-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-field-bg);
  box-shadow: var(--cp-inset);
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.cp-fileSearch__field:hover {
  border-color: var(--cp-field-border-hover);
  background: var(--cp-field-bg-hover);
}

.cp-fileSearch__field:focus-within {
  border-color: var(--cp-focus-border);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
}

.cp-fileSearch__field--search {
  flex: 1 1 240px;
  min-width: 180px;
}

.cp-fileSearch__field--select {
  position: relative;
  padding-right: 30px;
}

.cp-fileSearch__field--date {
  flex: 0 0 auto;
  padding-right: 8px;
}

.cp-fileSearch__icon {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

.cp-fileSearch__chevron {
  position: absolute;
  right: 10px;
  pointer-events: none;
  color: var(--cp-text-muted);
}

.cp-fileSearch__input,
.cp-fileSearch__select,
.cp-fileSearch__date {
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--cp-text);
  font-family: var(--cp-font-body);
  font-size: 13px;
  line-height: 1.4;
  outline: none;
  padding: 0;
}

/* 内部控件不叠加 focus ring（由字段容器承载） */
.cp-fileSearch__input:focus-visible,
.cp-fileSearch__select:focus-visible,
.cp-fileSearch__date:focus-visible {
  box-shadow: none;
}

.cp-fileSearch__input {
  flex: 1 1 auto;
}

.cp-fileSearch__input::placeholder {
  color: var(--cp-field-placeholder);
}

.cp-fileSearch__select {
  flex: 1 1 auto;
  appearance: none;
  cursor: pointer;
  padding-right: 2px;
}

.cp-fileSearch__date {
  flex: 0 0 auto;
  width: 132px;
  font-size: 12.5px;
  cursor: pointer;
}

/* 原生日期选择器图标跟随主题色（低饱和） */
.cp-fileSearch__date::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 0.55;
}
</style>
