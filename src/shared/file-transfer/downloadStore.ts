/**
 * @fileoverview downloadStore.ts
 * @description shared/file-transfer｜通用文件下载状态管理：任务跟踪、进度回调、前端触发保存。
 */

import { reactive, ref } from "vue";
import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { listen } from "@tauri-apps/api/event";

export interface DownloadResult {
  fileId: string;
  filePath: string;
  mimeType?: string;
  totalSize: number;
}

export interface DownloadTask {
  id: string;
  filename: string;
  status: "pending" | "downloading" | "completed" | "error";
  progress: number;
  downloaded: number;
  total: number;
  error?: string;
}

const downloadTasks = reactive<Map<string, DownloadTask>>(new Map());
const currentTaskId = ref<string>("");
let progressUnlisten: (() => void) | null = null;

function generateTaskId(): string {
  return `dl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatFilename(url: string): string {
  const segments = url.split("/");
  const last = segments[segments.length - 1] || "download";
  return decodeURIComponent(last.split("?")[0]);
}

async function ensureProgressListener(): Promise<void> {
  if (progressUnlisten) return;
  progressUnlisten = await listen<{ taskId: string; downloaded: number; total: number }>(
    "download:progress",
    (event) => {
      const { taskId, downloaded, total } = event.payload;
      const task = downloadTasks.get(taskId);
      if (!task) return;
      task.downloaded = downloaded;
      task.total = total;
      task.progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
    },
  );
}

export function destroyProgressListener(): void {
  progressUnlisten?.();
  progressUnlisten = null;
}

export async function downloadFile(url: string, token: string): Promise<string> {
  const taskId = generateTaskId();
  const task: DownloadTask = {
    id: taskId,
    filename: formatFilename(url),
    status: "pending",
    progress: 0,
    downloaded: 0,
    total: 0,
  };
  downloadTasks.set(taskId, task);
  currentTaskId.value = taskId;

  try {
    task.status = "downloading";
    await ensureProgressListener();

    const result = await invokeTauri<DownloadResult>(TAURI_COMMANDS.downloadFile, {
      url,
      token,
      taskId,
    });

    task.status = "completed";
    task.progress = 100;

    return result.fileId;
  } catch (e) {
    task.status = "error";
    task.error = String(e);
  }
  return taskId;
}

export async function saveTempFile(fileId: string, destination: string): Promise<string> {
  return invokeTauri<string>(TAURI_COMMANDS.saveTempFile, { fileId, destination });
}

export async function openTempFile(fileId: string): Promise<void> {
  return invokeTauri<void>(TAURI_COMMANDS.openTempFile, { fileId });
}

export function getDownloadTasks(): Map<string, DownloadTask> {
  return downloadTasks;
}

export function getCurrentTaskId() {
  return currentTaskId;
}

export function clearCompletedTasks(): void {
  for (const [id, task] of downloadTasks) {
    if (task.status === "completed" || task.status === "error") {
      downloadTasks.delete(id);
    }
  }
}
