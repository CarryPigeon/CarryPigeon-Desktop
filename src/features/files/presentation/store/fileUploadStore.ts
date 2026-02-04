/**
 * @fileoverview fileUploadStore.ts
 * @description File upload store for managing upload tasks.
 */

import { reactive, ref } from "vue";
import { getFileServicePort } from "@/features/files/di/files.di";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { ensureValidAccessToken } from "@/shared/net/auth/authSessionManager";
import { readAuthToken } from "@/shared/utils/localState";
import type { FileUploadResult } from "@/features/files/domain/types/FileTypes";

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
 * Generate a unique task id.
 *
 * @returns Unique task id.
 */
function generateTaskId(): string {
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Get current socket and valid token.
 *
 * @returns Tuple [socket, token].
 */
async function getSocketAndToken(): Promise<[string, string]> {
  const socket = currentServerSocket.value.trim();
  if (!socket) return ["", ""];
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  return [socket, token];
}

/**
 * Upload a file.
 *
 * @param file - File to upload.
 * @returns Promise<FileUploadResult>.
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

    // Step 1: Request upload descriptor
    task.progress = 20;
    const result = await fileService.requestUpload(socket, token, {
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    });

    // Step 2: Perform the actual upload
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
 * Cancel an upload task.
 *
 * @param taskId - Task id to cancel.
 */
export function cancelUpload(taskId: string): void {
  const task = uploadTasks.get(taskId);
  if (task && task.status === "uploading") {
    task.status = "error";
    task.error = "Cancelled";
  }
}

/**
 * Remove a task from the list.
 *
 * @param taskId - Task id to remove.
 */
export function removeTask(taskId: string): void {
  uploadTasks.delete(taskId);
}

/**
 * Get all upload tasks.
 *
 * @returns Upload tasks map.
 */
export function getUploadTasks(): Map<string, UploadTask> {
  return uploadTasks;
}

/**
 * Get a specific task by id.
 *
 * @param taskId - Task id.
 * @returns Upload task or undefined.
 */
export function getTask(taskId: string): UploadTask | undefined {
  return uploadTasks.get(taskId);
}

/**
 * Get the current active task id.
 *
 * @returns Current task id ref.
 */
export function getCurrentTaskId() {
  return currentTaskId;
}

/**
 * Build download URL for a share key.
 *
 * @param shareKey - File share key.
 * @returns Download URL.
 */
export function buildDownloadUrl(shareKey: string): string {
  const socket = currentServerSocket.value.trim();
  if (!socket || !shareKey) return "";
  return getFileServicePort().buildDownloadUrl(socket, shareKey);
}
