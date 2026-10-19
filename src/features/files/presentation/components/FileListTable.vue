<script setup lang="ts">
/**
 * @fileoverview FileListTable.vue
 * @description files｜文件列表表格组件（增强版：排序表头、多选、右键菜单）。
 */

import { ref } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { fileTypeIconName } from "@/shared/ui/icons/fileTypeIcon";
import ContextMenuSurface from "@/shared/ui/contextMenu/ContextMenuSurface.vue";
import ContextMenuItem from "@/shared/ui/contextMenu/ContextMenuItem.vue";
import ContextMenuSeparator from "@/shared/ui/contextMenu/ContextMenuSeparator.vue";
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

/**
 * 浮动菜单定位：由 `ContextMenuSurface` 统一测量并钳制到视口内。
 */

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

/**
 * 选择文件类型图标（自绘注册表 key）。
 *
 * @param mimeType - 文件 mime type。
 * @returns `AppIcon` 图标名。
 */
function getTypeIcon(mimeType: string): string {
  return fileTypeIconName(mimeType);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <!-- 组件：FileListTable｜职责：文件列表（11px 表头 / 48px 行高 / 细分隔线 / 选中 highlight） -->
  <div v-if="files.length === 0 && !loading" class="cp-fileTable__empty">
    <span class="cp-fileTable__emptyIcon"><AppIcon name="file" :size="22" /></span>
    <span class="cp-fileTable__emptyText">{{ t("file_list_empty") }}</span>
  </div>
  <div v-else class="cp-fileTable">
    <!-- 表头：与数据行同列宽；首列空标签用于对齐文件类型图标 -->
    <div class="cp-fileTable__header">
      <span class="cp-fileTable__checkbox" @click="handleSelectAll">
        <input type="checkbox" :checked="isAllSelected()" />
      </span>
      <span
        v-for="(col, index) in columns"
        :key="col.label || `col-${index}`"
        class="cp-fileTable__headerCell"
        :class="{
          'cp-fileTable__headerCell--sortable': col.sortable,
          'cp-fileTable__headerCell--icon': index === 0,
          'cp-fileTable__headerCell--name': col.field === 'filename',
        }"
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
      <span class="cp-fileTable__icon"><AppIcon :name="getTypeIcon(file.mimeType)" /></span>
      <div class="cp-fileTable__meta">
        <span class="cp-fileTable__name">{{ file.filename }}</span>
        <span v-if="file.channelName" class="cp-fileTable__channel">{{ file.channelName }}</span>
      </div>
      <span class="cp-fileTable__cell">{{ formatSize(file.sizeBytes) }}</span>
      <span class="cp-fileTable__cell">{{ formatTime(file.uploadedAt) }}</span>
      <span class="cp-fileTable__cell">{{ file.uploaderName || "-" }}</span>
      <span class="cp-fileTable__actions">
        <button
          class="cp-fileTable__actionBtn"
          type="button"
          :title="t('download')"
          :aria-label="t('download')"
          @click.stop="emit('download', file)"
        >
          <AppIcon name="download" />
        </button>
      </span>
    </div>
  </div>

  <!-- Context Menu -->
  <ContextMenuSurface
    :open="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :min-width="180"
    @close="closeContextMenu"
  >
    <ContextMenuItem @select="contextMenu.file && emit('preview', contextMenu.file)">
      <AppIcon name="browse" /> {{ t("file_preview") }}
    </ContextMenuItem>
    <ContextMenuItem @select="contextMenu.file && emit('download', contextMenu.file)">
      <AppIcon name="download" /> {{ t("download") }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem @select="contextMenu.file && emit('openChannel', contextMenu.file)">
      <AppIcon name="chat" /> {{ t("file_open_channel") }}
    </ContextMenuItem>
    <ContextMenuItem @select="contextMenu.file && emit('copyLink', contextMenu.file)">
      <AppIcon name="link" /> {{ t("file_copy_link") }}
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem danger @select="contextMenu.file && emit('delete', contextMenu.file)">
      <AppIcon name="delete" /> {{ t("file_delete") }}
    </ContextMenuItem>
  </ContextMenuSurface>
</template>

<style scoped lang="scss">
/* 样式：文件列表表格｜规格：微标签表头 + 48px 行 + 细分隔线 + 选中 highlight */
.cp-fileTable__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 56px 20px;
  text-align: center;
}

.cp-fileTable__emptyIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
}

.cp-fileTable__emptyText {
  font-size: 13px;
  color: var(--cp-text-muted);
}

/* 表头：11px uppercase / 0.08em；与数据行共用列宽 */
.cp-fileTable__header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 14px;
  border-bottom: 1px solid var(--cp-border-light);
  font-family: var(--cp-font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cp-text-muted);
}

.cp-fileTable__headerCell {
  flex: 1 1 0;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__headerCell--icon {
  flex: 0 0 32px;
}

.cp-fileTable__headerCell--name {
  flex: 2 1 0;
}

.cp-fileTable__headerCell--sortable {
  cursor: pointer;
  user-select: none;
  transition: color var(--cp-fast) var(--cp-ease);
}

.cp-fileTable__headerCell--sortable:hover {
  color: var(--cp-text);
}

.cp-fileTable__sortIcon {
  display: inline-flex;
  align-items: center;
  margin-left: 2px;
}

/* 复选框列与图标列固定宽度，保证表头/行对齐 */
.cp-fileTable__checkbox {
  width: 26px;
  flex: 0 0 26px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-fileTable__checkbox input {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--cp-accent);
  cursor: pointer;
}

/* 数据行：48px、层叠细分隔线、hover 只变底色 */
.cp-fileTable__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--cp-border-light);
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease);
}

.cp-fileTable__row:hover {
  background: var(--cp-hover-bg);
}

.cp-fileTable__row--selected {
  background: var(--cp-highlight-bg);
  box-shadow: inset 2px 0 0 var(--cp-highlight);
}

.cp-fileTable__row--selected:hover {
  background: var(--cp-highlight-bg-strong);
}

.cp-fileTable__icon {
  flex: 0 0 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-text-muted);
}

.cp-fileTable__meta {
  flex: 2 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cp-fileTable__name {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 频道 chip：等宽字体小徽标 */
.cp-fileTable__channel {
  align-self: flex-start;
  max-width: 100%;
  padding: 1px 7px;
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
  font-size: 10.5px;
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__cell {
  flex: 1 1 0;
  min-width: 0;
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileTable__actions {
  flex: 0 0 40px;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
}

/* 操作：统一图标按钮规格 */
.cp-fileTable__actionBtn {
  @include cp-icon-button;

  width: 30px;
  height: 30px;
}
</style>
