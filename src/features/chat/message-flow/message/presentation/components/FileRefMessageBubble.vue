<script setup lang="ts">
/**
 * @fileoverview FileRefMessageBubble.vue
 * @description
 * message-flow/message｜文件引用消息气泡组件。
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { buildFileDownloadUrl } from "@/shared/file-transfer/buildFileDownloadUrl";
import { useAuthedObjectUrl } from "@/shared/file-transfer/useAuthedObjectUrl";
import { readAuthToken } from "@/shared/utils/localState";
import { downloadFile, getDownloadTasks, resumeDownload } from "@/shared/file-transfer";
import { createLogger } from "@/shared/utils/logger";
import DownloadProgress from "@/features/chat/message-flow/download/presentation/components/DownloadProgress.vue";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { fileTypeIconName } from "@/shared/ui/icons/fileTypeIcon";

const props = defineProps<{
  /**
   * 展示名称（默认可直接传 share key）。
   */
  filename: string;
  /**
   * 文件 share key。
   */
  shareKey: string;
  /**
   * 文件 mime type（可选）。
   */
  mimeType?: string;
  /**
   * 文件大小（字节，可选）。
   */
  sizeBytes?: number;
}>();

const emit = defineEmits<{
  /**
   * 打开图片灯箱。
   */
  (e: "openLightbox", payload: { url: string; fileName: string }): void;
}>();

const { t } = useI18n();

const downloadUrl = computed(() => buildFileDownloadUrl(getActiveChatServerSocket(), props.shareKey));

const isImage = computed(() => {
  const mime = props.mimeType?.toLowerCase() ?? "";
  return mime.startsWith("image/");
});

// 图片预览需要 Bearer 鉴权，浏览器原生 <img> 无法附加 Authorization，故用 objectURL。
const { objectUrl: previewUrl } = useAuthedObjectUrl(
  () => (isImage.value ? downloadUrl.value : ""),
  () => getActiveChatServerSocket(),
);

/**
 * 将字节数格式化为紧凑可读标签。
 *
 * @param bytes - 文件大小（字节）。
 * @returns 人类可读字符串。
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "";
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
function getFileIcon(mimeType: string | undefined): string {
  return fileTypeIconName(mimeType);
}

const showDownloadProgress = ref(false);
const currentTaskId = ref<string>("");

const downloadTask = computed(() => {
  if (!showDownloadProgress.value || !currentTaskId.value) return null;
  return getDownloadTasks().get(currentTaskId.value) ?? null;
});

async function handleDownload(): Promise<void> {
  if (!downloadUrl.value) return;
  showDownloadProgress.value = true;
  try {
    const socket = getActiveChatServerSocket();
    const token = readAuthToken(socket) || "";
    currentTaskId.value = await downloadFile(downloadUrl.value, token, socket);
  } catch (e) {
    createLogger("FileRefMessageBubble").error("Action: chat_file_download_failed", { url: downloadUrl.value, error: String(e) });
  }
}

async function handleResume(): Promise<void> {
  if (!downloadUrl.value) return;
  try {
    const socket = getActiveChatServerSocket();
    const token = readAuthToken(socket) || "";
    currentTaskId.value = await resumeDownload(currentTaskId.value, downloadUrl.value, token, socket);
  } catch (e) {
    createLogger("FileRefMessageBubble").error("Action: chat_file_resume_failed", { url: downloadUrl.value, error: String(e) });
  }
}

function handleDismissTask(): void {
  showDownloadProgress.value = false;
  currentTaskId.value = "";
}
</script>

<template>
  <!-- 组件：FileRefMessageBubble｜职责：渲染文件引用消息 -->
  <div class="cp-fileBubble">
    <div v-if="isImage && downloadUrl" class="cp-fileBubble__preview" @click="emit('openLightbox', { url: downloadUrl, fileName: props.filename })">
      <img v-if="previewUrl" :src="previewUrl" :alt="props.filename" class="cp-fileBubble__img" />
    </div>
    <div class="cp-fileBubble__info">
      <div class="cp-fileBubble__icon"><AppIcon :name="getFileIcon(props.mimeType)" /></div>
      <div class="cp-fileBubble__meta">
        <div class="cp-fileBubble__name">{{ props.filename }}</div>
        <div v-if="props.sizeBytes" class="cp-fileBubble__size">{{ formatFileSize(props.sizeBytes) }}</div>
      </div>
    </div>
    <button v-if="downloadUrl && (!downloadTask || downloadTask.status !== 'error')" class="cp-fileBubble__btn" type="button" @click="handleDownload">
      {{ t("download") }}
    </button>
    <button v-if="downloadUrl && downloadTask && downloadTask.status === 'error'" class="cp-fileBubble__btn cp-fileBubble__btn--resume" type="button" @click="handleResume">
      {{ t("retry") }}
    </button>
    <DownloadProgress
      v-if="downloadTask"
      :task="downloadTask"
      @dismiss="handleDismissTask"
    />
  </div>
</template>

<style scoped lang="scss">
/* 样式：FileRefMessageBubble｜布局约束：文件气泡最大宽度 320px，图片预览限制高度；
   气泡表面用 panel + border-light（接收气泡统一配方） */
.cp-fileBubble {
  border: 1px solid var(--cp-border-light);
  background: var(--cp-panel);
  border-radius: var(--cp-radius-card);
  padding: 12px;
  max-width: 320px;
}

.cp-fileBubble__preview {
  margin-bottom: 10px;
  border-radius: var(--cp-radius-control);
  overflow: hidden;
  cursor: pointer;
}

.cp-fileBubble__img {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  background: var(--cp-panel-muted);
}

.cp-fileBubble__info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cp-fileBubble__icon {
  font-size: 24px;
}

.cp-fileBubble__meta {
  flex: 1;
  min-width: 0;
}

.cp-fileBubble__name {
  font-size: 13px;
  color: var(--cp-text);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-fileBubble__size {
  margin-top: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
  font-family: var(--cp-font-mono);
}

/* 下载按钮：主操作语义用 highlight；重试沿用 warn 状态 */
.cp-fileBubble__btn {
  @include cp-pill-button(primary);

  margin-top: 10px;
  width: 100%;
}

.cp-fileBubble__btn--resume {
  border-color: var(--cp-warn-border);
  background: var(--cp-warn-bg);
  color: var(--cp-warn);

  &:hover:not(:disabled) {
    border-color: var(--cp-warn);
    background: color-mix(in oklab, var(--cp-warn) 16%, var(--cp-hover-bg));
  }
}
</style>
