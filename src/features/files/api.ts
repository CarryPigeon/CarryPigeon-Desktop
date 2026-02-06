/**
 * @fileoverview files Feature 对外公共 API（跨 Feature 访问边界）。
 * @description
 * 对外只暴露“文件消息渲染”和“上传能力”所需的最小公开面。
 */

export {
  buildDownloadUrl,
  cancelUpload,
  getCurrentTaskId,
  getTask,
  getUploadTasks,
  removeTask,
  uploadFile,
  type UploadTask,
} from "./presentation/store/fileUploadStore";

export { default as FileUploadButton } from "./presentation/components/FileUploadButton.vue";
export { default as FileMessageBubble } from "./presentation/components/FileMessageBubble.vue";
