<script setup lang="ts">
/**
 * @fileoverview FilePreviewPanel.vue
 * @description files｜文件预览侧边面板（图片/视频/音频/PDF/其他）。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getChatCapabilities } from "@/features/chat/public/api";
import { buildFileDownloadUrl } from "@/shared/file-transfer";
import type { FileRecord } from "../../domain/contracts";

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
  const socket = getChatCapabilities().getServerSocket();
  if (!socket) return "";
  return buildFileDownloadUrl(socket, props.file.shareKey);
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getTypeIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("gzip")) return "📦";
  return "📎";
}

async function handleCopyLink(file: FileRecord): Promise<void> {
  const { copyTextToClipboard } = await import("@/shared/utils/clipboard");
  const fullUrl = buildFileDownloadUrl(getChatCapabilities().getServerSocket(), file.shareKey);
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
        <aside class="cp-previewPanel" @click.stop>
          <header class="cp-previewPanel__head">
            <span class="cp-previewPanel__filename">{{ file.filename }}</span>
            <button class="cp-previewPanel__close" type="button" @click="emit('close')">✕</button>
          </header>

          <div class="cp-previewPanel__body">
            <!-- Image Preview -->
            <img
              v-if="previewType === 'image'"
              class="cp-previewPanel__media"
              :src="downloadUrl"
              :alt="file.filename"
            />
            <!-- Video Preview -->
            <video
              v-else-if="previewType === 'video'"
              class="cp-previewPanel__media"
              :src="downloadUrl"
              controls
            />
            <!-- Audio Preview -->
            <audio
              v-else-if="previewType === 'audio'"
              class="cp-previewPanel__audio"
              :src="downloadUrl"
              controls
            />
            <!-- PDF Preview -->
            <object
              v-else-if="previewType === 'pdf'"
              class="cp-previewPanel__pdf"
              :data="downloadUrl"
              type="application/pdf"
            >
              <p>{{ t("file_no_preview") }}</p>
            </object>
            <!-- Too Large -->
            <div v-else-if="previewType === 'too-large'" class="cp-previewPanel__placeholder">
              <span class="cp-previewPanel__bigIcon">📦</span>
              <p>{{ t("file_size_too_large") }}</p>
            </div>
            <!-- Other -->
            <div v-else class="cp-previewPanel__placeholder">
              <span class="cp-previewPanel__bigIcon">{{ getTypeIcon(file.mimeType) }}</span>
              <p>{{ t("file_no_preview") }}</p>
            </div>
          </div>

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
              ⬇ {{ t("download") }}
            </button>
            <button class="cp-previewPanel__actionBtn cp-previewPanel__actionBtn--danger" type="button" @click="emit('delete', file)">
              🗑 {{ t("file_delete") }}
            </button>
            <button v-if="file.channelId" class="cp-previewPanel__actionBtn" type="button" @click="emit('openChannel', file)">
              # {{ t("file_open_channel") }}
            </button>
            <button class="cp-previewPanel__actionBtn" type="button" @click="handleCopyLink(file)">
              🔗 {{ t("file_copy_link") }}
            </button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.cp-previewOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: flex-end;
  z-index: 9000;
}

.cp-previewPanel {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: var(--cp-surface);
  border-left: 1px solid var(--cp-border);
  display: flex;
  flex-direction: column;
  box-shadow: var(--cp-shadow-strong);
}

.cp-previewPanel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--cp-border);
}

.cp-previewPanel__filename {
  font-size: 14px;
  font-weight: 600;
  color: var(--cp-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-previewPanel__close {
  border: none;
  background: none;
  color: var(--cp-text-muted);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.cp-previewPanel__close:hover {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
}

.cp-previewPanel__body {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #00000008;
  min-height: 200px;
}

.cp-previewPanel__media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.cp-previewPanel__audio {
  width: 100%;
}

.cp-previewPanel__pdf {
  width: 100%;
  height: 100%;
  min-height: 400px;
  border: none;
  border-radius: 8px;
}

.cp-previewPanel__placeholder {
  text-align: center;
  color: var(--cp-text-muted);
  font-size: 13px;
}

.cp-previewPanel__bigIcon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
}

.cp-previewPanel__meta {
  padding: 16px;
  border-top: 1px solid var(--cp-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cp-previewPanel__metaRow {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.cp-previewPanel__metaLabel {
  color: var(--cp-text-muted);
}

.cp-previewPanel__metaValue {
  color: var(--cp-text);
  font-weight: 500;
}

.cp-previewPanel__channelValue {
  color: var(--cp-accent, #3b82f6);
  cursor: pointer;
}

.cp-previewPanel__channelValue:hover {
  text-decoration: underline;
}

.cp-previewPanel__actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--cp-border);
  flex-wrap: wrap;
}

.cp-previewPanel__actionBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 11px;
  cursor: pointer;
  transition: border-color var(--cp-fast) var(--cp-ease);
  display: flex;
  align-items: center;
  gap: 4px;
}

.cp-previewPanel__actionBtn:hover {
  border-color: var(--cp-highlight-border);
}

.cp-previewPanel__actionBtn--danger {
  color: #e74c3c;
  border-color: #e74c3c;
}

/* Transition */
.cp-preview-enter-active,
.cp-preview-leave-active {
  transition: opacity 0.2s ease;
}
.cp-preview-enter-from,
.cp-preview-leave-to {
  opacity: 0;
}
.cp-preview-enter-active .cp-previewPanel,
.cp-preview-leave-active .cp-previewPanel {
  transition: transform 0.2s ease;
}
.cp-preview-enter-from .cp-previewPanel {
  transform: translateX(100%);
}
.cp-preview-leave-to .cp-previewPanel {
  transform: translateX(100%);
}
</style>
