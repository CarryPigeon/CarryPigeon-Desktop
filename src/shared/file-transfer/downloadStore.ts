/**
 * @fileoverview downloadStore.ts
 * @description shared/file-transfer｜通用文件下载状态管理：任务跟踪、进度回调、前端触发保存。
 */

import { reactive, ref } from "vue";
import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { safeListen } from "@/shared/tauri/events";

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
  progressUnlisten = await safeListen<{ taskId: string; downloaded: number; total: number }>(
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
  return startDownload(url, token);
}

/**
 * 续传下载：复用后端同 URL 未完成任务（state=downloading/failed）。
 *
 * 后端在同会话内会保留 `.part` 与 SQLite 记录，再次调用 `download_file`
 * 命令即触发 `Range: bytes={N}-` 请求；服务端若支持则返 206 续传，
 * 不支持则降级为全新下载。
 */
export async function resumeDownload(taskId: string, url: string, token: string): Promise<string> {
  const task = downloadTasks.get(taskId);
  if (task) {
    task.status = "downloading";
    task.error = undefined;
  }
  return startDownload(url, token, taskId);
}

async function startDownload(url: string, token: string, reuseTaskId?: string): Promise<string> {
  const taskId = reuseTaskId ?? generateTaskId();
  let task = downloadTasks.get(taskId);
  if (!task) {
    task = {
      id: taskId,
      filename: formatFilename(url),
      status: "pending",
      progress: 0,
      downloaded: 0,
      total: 0,
    };
    downloadTasks.set(taskId, task);
  } else {
    task.status = "pending";
    task.error = undefined;
  }
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
