/**
 * @fileoverview files.di.ts 文件职责说明。
 */
import { tcpFileUploadAdapter } from "../data/tcpFileUploadAdapter";
import { RequestUpload } from "../domain/usecases/RequestUpload";

let requestUpload: RequestUpload | null = null;

/**
 * getRequestUploadUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getRequestUploadUsecase(): RequestUpload {
  if (requestUpload) return requestUpload;
  requestUpload = new RequestUpload(tcpFileUploadAdapter);
  return requestUpload;
}

