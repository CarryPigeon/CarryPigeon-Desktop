/**
 * @fileoverview fileAttachmentStore.ts
 * @description chat/message-flow/upload｜展示层状态（store）：fileAttachmentStore。
 *
 * 管理待上传附件（从剪贴板粘贴或拖拽产生），与 fileUploadStore 分工：
 * - fileUploadStore：管理实际上传任务的生命周期（upload_* 前缀）。
 * - fileAttachmentStore：管理 composer 里的“待发送”附件预览（att_* 前缀）。
 */

import { reactive, onUnmounted } from "vue";

/**
 * 附件种类（用于预览条选择渲染分支）。
 *
 * - image: 通过 MIME 识别的图片类型，预览条显示缩略图。
 * - video: 通过 MIME 识别的视频类型，预览条显示缩略图。
 * - file: 其他任意文件类型，预览条显示文件图标 + 文件名 + 体积。
 */
export type FileAttachmentKind = "image" | "video" | "file";

/**
 * 单个附件展示模型（用于 composer 预览）。
 */
export type FileAttachment = {
  /** 附件本地唯一 id（`att_` 前缀）。 */
  id: string;
  /** 原始 File 对象。 */
  file: File;
  /** 通过 URL.createObjectURL 创建的 blob URL（仅 image/video 存在）。 */
  blobUrl: string;
  /** 附件种类。 */
  kind: FileAttachmentKind;
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

/**
 * 根据 MIME 类型推导附件种类。
 *
 * 使用前缀匹配与代码库其他位置保持一致，避免遗漏合法类型（如 image/heic、video/3gpp）。
 * 空 MIME 退化为 `file`。
 *
 * @param mime - 文件 MIME。
 * @returns 推导出的附件种类。
 */
function inferKind(mime: string): FileAttachmentKind {
  const t = mime.trim().toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  return "file";
}

/**
 * 添加文件到附件列表。
 *
 * 接受任意类型的文件：图片、视频、文档、压缩包等。
 * 文件大小与类型交由服务端与网络层决定，本地不做硬性限制。
 *
 * @param files - FileList 或 File 数组。
 */
export function addFiles(files: FileList | File[]): void {
  for (const file of Array.from(files)) {
    const id = generateId();
    const kind = inferKind(file.type);
    const blobUrl = kind === "file" ? "" : URL.createObjectURL(file);
    attachments.set(id, {
      id,
      file,
      blobUrl,
      kind,
      status: "pending",
      progress: 0,
    });
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
 * 分离全部附件（不释放 blob URL）。
 *
 * 用于将附件 blob URL 所有权转移给消息对象后清理附件存储，
 * 避免释放已被消息引用的 blob URL。
 */
export function detachAttachments(): void {
  attachments.clear();
}

/**
 * 分离指定附件（不释放 blob URL）。
 *
 * @param id - 附件 id。
 */
export function detachAttachment(id: string): void {
  attachments.delete(id);
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
