/**
 * @fileoverview shared/file-transfer 对外 API。
 * @description
 * 聚合文件传输相关的通用能力（类型、端口、HTTP 实现、用例与 URL 构建）。
 */

export { buildFileDownloadUrl } from "./buildFileDownloadUrl";
export { httpFileServicePort } from "./httpFileServicePort";
export type { FileServicePort } from "./fileServicePort";
export type { FileUploadRequest, FileUploadResult, UploadDescriptor } from "./types";
export { GetDownloadUrl } from "./usecases/GetDownloadUrl";
export { PerformFileUpload } from "./usecases/PerformFileUpload";
export { RequestFileUpload } from "./usecases/RequestFileUpload";
