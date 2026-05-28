/**
 * @fileoverview fileAttachmentStore.ts
 * @description chat/message-flow/upload｜展示层状态（store）：fileAttachmentStore。
 *
 * 管理待上传图片附件（从剪贴板粘贴或拖拽产生），与 fileUploadStore 分工：
 * - fileUploadStore：管理实际上传任务的生命周期（upload_* 前缀）。
 * - fileAttachmentStore：管理 composer 里的“待发送”附件预览（att_* 前缀）。
 */

import { reactive, onUnmounted } from "vue";

/**
 * 单个附件展示模型（用于 composer 预览）。
 */
export type FileAttachment = {
  /** 附件本地唯一 id（`att_` 前缀）。 */
  id: string;
  /** 原始 File 对象。 */
  file: File;
  /** 通过 URL.createObjectURL 创建的 blob URL（供 `<img>` 使用）。 */
  blobUrl: string;
  /** 附件状态。 */
  status: "pending" | "uploading" | "done" | "error";
  /** 上传进度（0–100）。 */
  progress: number;
  /** 上传完成后得到的 share key。 */
  shareKey?: string;
  /** 错误信息。 */
  error?: string;
};

const attachments = reactive<Map<string, FileAttachment>>(new Map());

/**
 * 生成附件本地唯一 id。
 *
 * @returns 形如 `att_1717000000000_a1b2c3` 的 id。
 */
function generateId(): string {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
];

/**
 * 添加文件（仅过滤出图片类型）到附件列表。
 *
 * @param files - FileList 或 File 数组。
 */
export function addFiles(files: FileList | File[]): void {
  for (const file of Array.from(files)) {
    if (!IMAGE_TYPES.includes(file.type)) continue;
    const id = generateId();
    const blobUrl = URL.createObjectURL(file);
    attachments.set(id, { id, file, blobUrl, status: "pending", progress: 0 });
  }
}

/**
 * 移除指定附件并释放 blob URL。
 *
 * @param id - 附件 id。
 */
export function removeAttachment(id: string): void {
  const att = attachments.get(id);
  if (att) {
    URL.revokeObjectURL(att.blobUrl);
    attachments.delete(id);
  }
}

/**
 * 清空全部附件并释放所有 blob URL。
 */
export function clearAttachments(): void {
  for (const att of attachments.values()) {
    URL.revokeObjectURL(att.blobUrl);
  }
  attachments.clear();
}

/**
 * 更新指定附件的上传进度。
 *
 * @param id - 附件 id。
 * @param progress - 进度值（0–100）。
 */
export function updateProgress(id: string, progress: number): void {
  const att = attachments.get(id);
  if (att) att.progress = progress;
}

/**
 * 标记附件上传完成。
 *
 * @param id - 附件 id。
 * @param shareKey - 上传后得到的 share key。
 */
export function markDone(id: string, shareKey: string): void {
  const att = attachments.get(id);
  if (att) {
    att.status = "done";
    att.progress = 100;
    att.shareKey = shareKey;
  }
}

/**
 * 标记附件上传失败。
 *
 * @param id - 附件 id。
 * @param error - 错误描述。
 */
export function markError(id: string, error: string): void {
  const att = attachments.get(id);
  if (att) {
    att.status = "error";
    att.error = error;
  }
}

/**
 * 获取全部附件的只读 Map。
 *
 * @returns 附件 Map（id → FileAttachment）。
 */
export function getAttachments(): ReadonlyMap<string, FileAttachment> {
  return attachments;
}

/**
 * 获取所有待上传的附件列表。
 *
 * @returns 状态为 "pending" 的附件数组。
 */
export function getPendingAttachments(): FileAttachment[] {
  return Array.from(attachments.values()).filter((a) => a.status === "pending");
}

/**
 * 在组件卸载时自动清空附件。
 *
 * 用法：在组件 setup 中调用 `useAttachmentCleanup()`。
 */
export function useAttachmentCleanup(): void {
  onUnmounted(() => clearAttachments());
}
