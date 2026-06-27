<script setup lang="ts">
/**
 * @fileoverview FileListTable.vue
 * @description files｜文件列表表格组件（增强版：排序表头、多选、右键菜单）。
 */

import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
import type { FileRecord, FileSortField, SortOrder } from "../../domain/contracts";

const props = defineProps<{
  files: FileRecord[];
  sortBy: FileSortField;
  sortOrder: SortOrder;
  selectedIds: Set<string>;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "sort", field: FileSortField): void;
  (e: "toggleSelect", fileId: string): void;
  (e: "selectAll"): void;
  (e: "deselectAll"): void;
  (e: "download", file: FileRecord): void;
  (e: "delete", file: FileRecord): void;
  (e: "preview", file: FileRecord): void;
  (e: "openChannel", file: FileRecord): void;
  (e: "copyLink", file: FileRecord): void;
}>();

const { t } = useI18n();

const contextMenu = ref<{ visible: boolean; x: number; y: number; file: FileRecord | null }>({
  visible: false,
  x: 0,
  y: 0,
  file: null,
});

const columns: { field: FileSortField | null; label: string; sortable: boolean }[] = [
  { field: null, label: "", sortable: false },
  { field: "filename", label: t("file_sort_filename"), sortable: true },
  { field: "sizeBytes", label: t("file_sort_size"), sortable: true },
  { field: "uploadedAt", label: t("file_sort_date"), sortable: true },
  { field: null, label: t("file_uploader"), sortable: false },
  { field: null, label: t("file_actions"), sortable: false },
];

function getSortIndicator(field: FileSortField): "sort-asc" | "sort-desc" | "" {
  if (props.sortBy !== field) return "";
  return props.sortOrder === "asc" ? "sort-asc" : "sort-desc";
}

function handleHeaderClick(field: FileSortField): void {
  emit("sort", field);
}

function handleRowClick(file: FileRecord): void {
  emit("preview", file);
}

function handleContextMenu(event: MouseEvent, file: FileRecord): void {
  event.preventDefault();
  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, file };
}

function closeContextMenu(): void {
  contextMenu.value.visible = false;
}

onMounted(() => {
  document.addEventListener("click", closeContextMenu);
});

onUnmounted(() => {
  document.removeEventListener("click", closeContextMenu);
});

function isAllSelected(): boolean {
  return props.files.length > 0 && props.files.every((f) => props.selectedIds.has(f.id));
}

function handleSelectAll(): void {
  isAllSelected() ? emit("deselectAll") : emit("selectAll");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("gzip")) return "📦";
  return "📎";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div v-if="files.length === 0 && !loading" class="cp-fileTable__empty">
    {{ t("file_list_empty") }}
  </div>
  <div v-else class="cp-fileTable">
    <div class="cp-fileTable__header">
      <span class="cp-fileTable__checkbox" @click="handleSelectAll">
        <input type="checkbox" :checked="isAllSelected()" />
      </span>
      <span class="cp-fileTable__headerCell cp-fileTable__headerCell--icon" />
      <span
        v-for="col in columns"
        :key="col.label"
        class="cp-fileTable__headerCell"
        :class="{ 'cp-fileTable__headerCell--sortable': col.sortable }"
        @click="col.sortable && col.field && handleHeaderClick(col.field)"
      >
        {{ col.label }}
        <span v-if="col.sortable && col.field" class="cp-fileTable__sortIcon">
          <AppIcon v-if="getSortIndicator(col.field) !== ''" :name="getSortIndicator(col.field)" :size="10" :stroke-width="2" />
        </span>
      </span>
    </div>

    <div
      v-for="file in files"
      :key="file.id"
      class="cp-fileTable__row"
      :class="{ 'cp-fileTable__row--selected': selectedIds.has(file.id) }"
      @click="handleRowClick(file)"
      @contextmenu="handleContextMenu($event, file)"
    >
      <span class="cp-fileTable__checkbox" @click.stop>
        <input
          type="checkbox"
          :checked="selectedIds.has(file.id)"
          @change="emit('toggleSelect', file.id)"
        />
      </span>
      <span class="cp-fileTable__icon">{{ getTypeIcon(file.mimeType) }}</span>
      <div class="cp-fileTable__meta">
        <span class="cp-fileTable__name">{{ file.filename }}</span>
        <span v-if="file.channelName" class="cp-fileTable__channel">{{ file.channelName }}</span>
      </div>
      <span class="cp-fileTable__cell">{{ formatSize(file.sizeBytes) }}</span>
      <span class="cp-fileTable__cell">{{ formatTime(file.uploadedAt) }}</span>
      <span class="cp-fileTable__cell">{{ file.uploaderName || "-" }}</span>
      <span class="cp-fileTable__actions">
        <button class="cp-fileTable__actionBtn" type="button" :title="t('download')" @click.stop="emit('download', file)">
          <t-icon name="download" />
        </button>
      </span>
    </div>
  </div>

  <!-- Context Menu -->
  <Teleport to="body">
    <div
      v-if="contextMenu.visible"
      class="cp-contextMenu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop="closeContextMenu"
    >
      <div class="cp-contextMenu__item" @click="contextMenu.file && emit('preview', contextMenu.file)">
        <t-icon name="view" /> {{ t("file_preview") }}
      </div>
      <div class="cp-contextMenu__item" @click="contextMenu.file && emit('download', contextMenu.file)">
        <t-icon name="download" /> {{ t("download") }}
      </div>
      <div class="cp-contextMenu__divider" />
      <div class="cp-contextMenu__item" @click="contextMenu.file && emit('openChannel', contextMenu.file)">
        <t-icon name="chat" /> {{ t("file_open_channel") }}
      </div>
      <div class="cp-contextMenu__item" @click="contextMenu.file && emit('copyLink', contextMenu.file)">
        <t-icon name="link" /> {{ t("file_copy_link") }}
      </div>
      <div class="cp-contextMenu__divider" />
      <div class="cp-contextMenu__item cp-contextMenu__item--danger" @click="contextMenu.file && emit('delete', contextMenu.file)">
        <t-icon name="delete" /> {{ t("file_delete") }}
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.cp-fileTable__empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-fileTable__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 2px solid var(--cp-border);
  font-size: 11px;
  font-weight: 600;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cp-fileTable__headerCell {
  cursor: default;
  flex: 1;
}

.cp-fileTable__headerCell--sortable {
  cursor: pointer;
  user-select: none;
}

.cp-fileTable__headerCell--sortable:hover {
  color: var(--cp-text);
}

.cp-fileTable__sortIcon {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  margin-left: 2px;
  vertical-align: -1px;
}

.cp-fileTable__checkbox {
  width: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-fileTable__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  min-height: 44px;
  border-bottom: 1px solid var(--cp-border);
  transition: background var(--cp-fast) var(--cp-ease);
  cursor: pointer;
}

.cp-fileTable__row:last-child {
  border-bottom: none;
}

.cp-fileTable__row:hover {
  background: var(--cp-hover-bg);
}

.cp-fileTable__row--selected {
  background: var(--cp-accent-bg, rgba(59, 130, 246, 0.08));
}

.cp-fileTable__icon {
  font-size: 20px;
  flex-shrink: 0;
  width: 32px;
  text-align: center;
}

.cp-fileTable__meta {
  flex: 2;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-fileTable__name {
  font-size: 13px;
  color: var(--cp-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__channel {
  font-size: 10px;
  color: var(--cp-text-muted);
  background: var(--cp-panel-muted);
  padding: 1px 6px;
  border-radius: 999px;
  align-self: flex-start;
}

.cp-fileTable__cell {
  flex: 1;
  font-size: 12px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__actions {
  flex-shrink: 0;
  width: 40px;
  text-align: center;
}

.cp-fileTable__actionBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  color: var(--cp-text-muted);
  font-size: 14px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background var(--cp-fast) var(--cp-ease);
}

.cp-fileTable__actionBtn:hover {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
}
</style>

<!-- Context Menu Styles (unscoped, teleported) -->
<style lang="scss">
.cp-contextMenu {
  position: fixed;
  z-index: 9999;
  min-width: 160px;
  background: var(--cp-surface);
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  box-shadow: var(--cp-shadow-strong);
  padding: 4px 0;
  overflow: hidden;
}

.cp-contextMenu__item {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--cp-text);
  cursor: pointer;
  transition: background var(--cp-fast) var(--cp-ease);
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-contextMenu__item:hover {
  background: var(--cp-hover-bg);
}

.cp-contextMenu__item--danger {
  color: #e74c3c;
}

.cp-contextMenu__divider {
  height: 1px;
  background: var(--cp-border);
  margin: 4px 8px;
}
</style>
