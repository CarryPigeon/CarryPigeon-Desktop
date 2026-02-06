/**
 * @fileoverview fileUploadStore.ts
 * @description files｜展示层状态（store）：fileUploadStore。
 */

import { reactive, ref } from "vue";
import { getFileServicePort } from "@/features/files/di/files.di";
import { currentServerSocket } from "@/features/servers/api";
import { ensureValidAccessToken } from "@/shared/net/auth/authSessionManager";
import { readAuthToken } from "@/shared/utils/localState";
import type { FileUploadResult } from "@/features/files/domain/types/FileTypes";

/**
 * 单个上传任务的状态模型（用于 UI 展示与管理）。
 */
export type UploadTask = {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  result?: FileUploadResult;
  error?: string;
};

const uploadTasks = reactive<Map<string, UploadTask>>(new Map());
const currentTaskId = ref<string>("");

/**
 * 生成上传任务的本地唯一 id。
 *
 * @returns 任务 id。
 */
function generateTaskId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 获取当前 socket 与可用 token。
 *
 * 说明：
 * - 会尽力刷新即将过期的 token，避免立刻鉴权失败。
 *
 * @returns 二元组 `[socket, token]`（均已 trim）。
 */
async function getSocketAndToken(): Promise<[string, string]> {
  const socket = currentServerSocket.value.trim();
  if (!socket) return ["", ""];
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  return [socket, token];
}

/**
 * 上传文件（两段式：请求 descriptor → 执行实际上传）。
 *
 * @param file - 要上传的文件。
 * @returns 上传结果（包含 file_id/share_key 与 upload descriptor）。
 */
export async function uploadFile(file: File): Promise<FileUploadResult> {
  const taskId = generateTaskId();
  const task: UploadTask = {
    id: taskId,
    file,
    status: "pending",
    progress: 0,
  };
  uploadTasks.set(taskId, task);
  currentTaskId.value = taskId;

  try {
    task.status = "uploading";
    task.progress = 10;

    const [socket, token] = await getSocketAndToken();
    if (!socket || !token) {
      throw new Error("Not signed in");
    }

    const fileService = getFileServicePort();

    // 第 1 步：请求 upload descriptor
    task.progress = 20;
    const result = await fileService.requestUpload(socket, token, {
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });

    // 第 2 步：执行实际上传
    task.progress = 50;
    const buffer = await file.arrayBuffer();
    await fileService.performUpload(result.upload, buffer);

    task.progress = 100;
    task.status = "success";
    task.result = result;
    return result;
  } catch (e) {
    task.status = "error";
    task.error = String(e);
    throw e;
  }
}

/**
 * 取消上传任务（best-effort）。
 *
 * 说明：
 * - 当前实现不支持中断正在进行的 fetch/upload；这里只标记任务为 error。
 *
 * @param taskId - 任务 id。
 */
export function cancelUpload(taskId: string): void {
  const task = uploadTasks.get(taskId);
  if (task && task.status === "uploading") {
    task.status = "error";
    task.error = "Cancelled";
  }
}

/**
 * 从任务列表移除某个任务。
 *
 * @param taskId - 任务 id。
 */
export function removeTask(taskId: string): void {
  uploadTasks.delete(taskId);
}

/**
 * 获取全部上传任务。
 *
 * @returns 上传任务 Map（taskId → task）。
 */
export function getUploadTasks(): Map<string, UploadTask> {
  return uploadTasks;
}

/**
 * 获取指定任务。
 *
 * @param taskId - 任务 id。
 * @returns 任务对象；不存在时返回 `undefined`。
 */
export function getTask(taskId: string): UploadTask | undefined {
  return uploadTasks.get(taskId);
}

/**
 * 获取当前活跃任务 id（用于 UI 侧聚焦/回显）。
 *
 * @returns 当前任务 id 的 Ref。
 */
export function getCurrentTaskId() {
  return currentTaskId;
}

/**
 * 构建 share key 对应的下载 URL。
 *
 * @param shareKey - 文件 share key。
 * @returns 下载 URL（无法构建时返回空字符串）。
 */
export function buildDownloadUrl(shareKey: string): string {
  const socket = currentServerSocket.value.trim();
  if (!socket || !shareKey) return "";
  return getFileServicePort().buildDownloadUrl(socket, shareKey);
}
