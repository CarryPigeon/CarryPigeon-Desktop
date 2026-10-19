<script setup lang="ts">
/**
 * @fileoverview FilePreviewPanel.vue
 * @description files｜文件预览侧边面板（图片/视频/音频/PDF/其他）。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { readActiveFileServerSocket } from "../../composition/activeServerSocket";
import { buildFileDownloadUrl } from "@/shared/file-transfer";
import { useAuthedObjectUrl } from "@/shared/file-transfer/useAuthedObjectUrl";
import type { FileRecord } from "../../domain/contracts";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { fileTypeIconName } from "@/shared/ui/icons/fileTypeIcon";

const props = defineProps<{
  file: FileRecord | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "download", file: FileRecord): void;
  (e: "delete", file: FileRecord): void;
  (e: "openChannel", file: FileRecord): void;
  (e: "copyLink", file: FileRecord): void;
}>();

const { t } = useI18n();

const MAX_PREVIEW_SIZE = 50 * 1024 * 1024; // 50MB

const previewType = computed<"image" | "video" | "audio" | "pdf" | "other" | "too-large">(() => {
  if (!props.file) return "other";
  if (props.file.sizeBytes > MAX_PREVIEW_SIZE) return "too-large";
  const mime = props.file.mimeType;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  return "other";
});

const downloadUrl = computed(() => {
  if (!props.file) return "";
  const socket = readActiveFileServerSocket();
  if (!socket) return "";
  return buildFileDownloadUrl(socket, props.file.shareKey);
});

// 文件下载端点受 Bearer 鉴权保护，原生媒体标签无法附加 Authorization，故用 objectURL。
const { objectUrl: mediaObjectUrl } = useAuthedObjectUrl(
  () => downloadUrl.value,
  () => readActiveFileServerSocket() ?? "",
);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

async function handleCopyLink(file: FileRecord): Promise<void> {
  const { copyTextToClipboard } = await import("@/shared/utils/clipboard");
  const fullUrl = buildFileDownloadUrl(readActiveFileServerSocket(), file.shareKey);
  const ok = await copyTextToClipboard(fullUrl || file.shareKey);
  if (ok) {
    emit("copyLink", file);
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="cp-preview">
      <div v-if="visible && file" class="cp-previewOverlay" @click.self="emit('close')">
        <!-- 预览抽屉：一级玻璃面板 + 左侧 18px 圆角 -->
        <aside class="cp-previewPanel" role="dialog" aria-modal="true" :aria-label="file.filename" @click.stop>
          <header class="cp-previewPanel__head">
            <span class="cp-previewPanel__filename">{{ file.filename }}</span>
            <button
              class="cp-previewPanel__close"
              type="button"
              :aria-label="t('close')"
              :title="t('close')"
              @click="emit('close')"
            >
              <AppIcon name="close" />
            </button>
          </header>

          <div class="cp-previewPanel__body">
            <!-- Image Preview -->
            <img
              v-if="previewType === 'image'"
              class="cp-previewPanel__media"
              :src="mediaObjectUrl"
              :alt="file.filename"
            />
            <!-- Video Preview -->
            <video
              v-else-if="previewType === 'video'"
              class="cp-previewPanel__media"
              :src="mediaObjectUrl"
              controls
            />
            <!-- Audio Preview -->
            <audio
              v-else-if="previewType === 'audio'"
              class="cp-previewPanel__audio"
              :src="mediaObjectUrl"
              controls
            />
            <!-- PDF Preview -->
            <object
              v-else-if="previewType === 'pdf'"
              class="cp-previewPanel__pdf"
              :data="mediaObjectUrl"
              type="application/pdf"
            >
              <p>{{ t("file_no_preview") }}</p>
            </object>
            <!-- Too Large -->
            <div v-else-if="previewType === 'too-large'" class="cp-previewPanel__placeholder">
              <span class="cp-previewPanel__bigIcon"><AppIcon name="package" :size="36" /></span>
              <p>{{ t("file_size_too_large") }}</p>
            </div>
            <!-- Other -->
            <div v-else class="cp-previewPanel__placeholder">
              <span class="cp-previewPanel__bigIcon"><AppIcon :name="getTypeIcon(file.mimeType)" :size="36" /></span>
              <p>{{ t("file_no_preview") }}</p>
            </div>
          </div>

          <!-- 元信息：分组行的轻分隔线 -->
          <div class="cp-previewPanel__meta">
            <div class="cp-previewPanel__metaRow">
              <span class="cp-previewPanel__metaLabel">{{ t("file_type") }}</span>
              <span class="cp-previewPanel__metaValue">{{ file.mimeType }}</span>
            </div>
            <div class="cp-previewPanel__metaRow">
              <span class="cp-previewPanel__metaLabel">{{ t("file_sort_size") }}</span>
              <span class="cp-previewPanel__metaValue">{{ formatSize(file.sizeBytes) }}</span>
            </div>
            <div v-if="file.uploaderName" class="cp-previewPanel__metaRow">
              <span class="cp-previewPanel__metaLabel">{{ t("file_uploader") }}</span>
              <span class="cp-previewPanel__metaValue">{{ file.uploaderName }}</span>
            </div>
            <div class="cp-previewPanel__metaRow">
              <span class="cp-previewPanel__metaLabel">{{ t("file_sort_date") }}</span>
              <span class="cp-previewPanel__metaValue">{{ formatTime(file.uploadedAt) }}</span>
            </div>
            <div v-if="file.channelName" class="cp-previewPanel__metaRow">
              <span class="cp-previewPanel__metaLabel">{{ t("file_open_channel") }}</span>
              <span class="cp-previewPanel__metaValue cp-previewPanel__channelValue" @click="emit('openChannel', file)">
                #{{ file.channelName }}
              </span>
            </div>
          </div>

          <div class="cp-previewPanel__actions">
            <button class="cp-previewPanel__actionBtn" type="button" @click="emit('download', file)">
              <AppIcon name="download" :size="14" /> {{ t("download") }}
            </button>
            <button class="cp-previewPanel__actionBtn cp-previewPanel__actionBtn--danger" type="button" @click="emit('delete', file)">
              <AppIcon name="delete" :size="14" /> {{ t("file_delete") }}
            </button>
            <button v-if="file.channelId" class="cp-previewPanel__actionBtn" type="button" @click="emit('openChannel', file)">
              <AppIcon name="chat" :size="14" /> {{ t("file_open_channel") }}
            </button>
            <button class="cp-previewPanel__actionBtn" type="button" @click="handleCopyLink(file)">
              <AppIcon name="link" :size="14" /> {{ t("file_copy_link") }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：文件预览抽屉｜规格：玻璃面板 + 模糊遮罩 + 左侧 18px 圆角 + 状态 token */
.cp-previewOverlay {
  position: fixed;
  inset: 0;
  display: flex;
  justify-content: flex-end;
  background: rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 9000;
}

/* 抽屉面板：一级玻璃面板，仅左侧圆角 */
.cp-previewPanel {
  @include cp-glass-panel;

  width: 430px;
  max-width: 92vw;
  height: 100%;
  border-radius: var(--cp-radius-lg) 0 0 var(--cp-radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cp-previewPanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cp-border-light);
}

.cp-previewPanel__filename {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--cp-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--cp-text);
}

/* 关闭：统一图标按钮规格 */
.cp-previewPanel__close {
  @include cp-icon-button;

  flex: 0 0 auto;
}

.cp-previewPanel__body {
  flex: 1 1 auto;
  min-height: 200px;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--cp-panel-muted);
}

.cp-previewPanel__media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--cp-radius-control);
}

.cp-previewPanel__audio {
  width: 100%;
}

.cp-previewPanel__pdf {
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: none;
  border-radius: var(--cp-radius-control);
}

.cp-previewPanel__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-previewPanel__bigIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-card);
  background: var(--cp-panel);
  color: var(--cp-text-muted);
}

/* 元信息分组：行之间 1px 细分隔线 */
.cp-previewPanel__meta {
  padding: 4px 16px 8px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-previewPanel__metaRow {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  font-size: 12px;
}

.cp-previewPanel__metaRow + .cp-previewPanel__metaRow {
  border-top: 1px solid var(--cp-border-light);
}

.cp-previewPanel__metaLabel {
  flex: 0 0 auto;
  color: var(--cp-text-muted);
}

.cp-previewPanel__metaValue {
  min-width: 0;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  text-align: right;
  overflow-wrap: anywhere;
}

.cp-previewPanel__channelValue {
  color: var(--cp-accent);
  cursor: pointer;
}

.cp-previewPanel__channelValue:hover {
  text-decoration: underline;
}

.cp-previewPanel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--cp-border-light);
}

/* 动作：胶囊按钮（危险操作用状态 token） */
.cp-previewPanel__actionBtn {
  @include cp-pill-button;

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.cp-previewPanel__actionBtn--danger {
  @include cp-pill-button(danger);

  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

/* Transition：遮罩淡入 + 抽屉右侧滑入 */
.cp-preview-enter-active,
.cp-preview-leave-active {
  transition: opacity var(--cp-fast) var(--cp-ease);
}

.cp-preview-enter-from,
.cp-preview-leave-to {
  opacity: 0;
}

.cp-preview-enter-active .cp-previewPanel,
.cp-preview-leave-active .cp-previewPanel {
  transition: transform var(--cp-slow) var(--cp-ease);
}

.cp-preview-enter-from .cp-previewPanel,
.cp-preview-leave-to .cp-previewPanel {
  transform: translateX(100%);
}
</style>
