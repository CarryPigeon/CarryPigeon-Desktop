/**
 * @fileoverview upload runtime access facade。
 * @description
 * 收敛 upload 子域的任务查询与命令入口，避免子域 API 直接依赖 presentation store。
 *
 * 理解方式：
 * - upload 仍然是 message-flow 的子域；
 * - `api.ts` 只通过这里拿到任务查询和上传命令；
 * - 具体任务状态机仍由 presentation/runtime 持有。
 */

import {
  buildDownloadUrl,
  cancelUpload,
  getCurrentTaskId,
  getTask,
  getUploadTasks,
  removeTask,
  uploadFile,
  type UploadTask,
} from "./fileUploadStore";

export {
  buildDownloadUrl,
  cancelUpload,
  getCurrentTaskId,
  getTask,
  getUploadTasks,
  removeTask,
  uploadFile,
};

export type { UploadTask };
