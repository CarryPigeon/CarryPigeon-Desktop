import type { FileServicePort } from "./fileServicePort";
import { httpFileServicePort } from "./httpFileServicePort";
import type { FileUploadResult } from "./types";

/** 申请上传授权并按需写入原始文件字节。 */
export async function uploadFileContent(
  serverSocket: string,
  accessToken: string,
  file: File,
  fileService: FileServicePort = httpFileServicePort,
  onUploadAuthorized?: () => void,
): Promise<FileUploadResult> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const result = await fileService.requestUpload(serverSocket, accessToken, {
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    sha256,
  });
  if (!result.upload.hasSame) {
    onUploadAuthorized?.();
    await fileService.performUpload(serverSocket, accessToken, result.upload, file);
  }
  return result;
}
