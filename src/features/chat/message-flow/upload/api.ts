/**
 * @fileoverview chat/message-flow/upload 对外 API。
 * @description
 * 暴露聊天消息流中的文件上传任务能力。
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
} from "./application/uploadTaskState";

export type UploadCapabilities = {
  buildDownloadUrl: typeof buildDownloadUrl;
  cancelUpload: typeof cancelUpload;
  getCurrentTaskId: typeof getCurrentTaskId;
  getTask: typeof getTask;
  getUploadTasks: typeof getUploadTasks;
  removeTask: typeof removeTask;
  uploadFile: typeof uploadFile;
};

/**
 * 创建上传子域能力对象。
 */
export function createUploadCapabilities(): UploadCapabilities {
  return {
    buildDownloadUrl,
    cancelUpload,
    getCurrentTaskId,
    getTask,
    getUploadTasks,
    removeTask,
    uploadFile,
  };
}

let uploadCapabilitiesSingleton: UploadCapabilities | null = null;

/**
 * 获取上传子域共享能力对象。
 */
export function getUploadCapabilities(): UploadCapabilities {
  uploadCapabilitiesSingleton ??= createUploadCapabilities();
  return uploadCapabilitiesSingleton;
}

export type { UploadTask };
