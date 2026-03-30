/**
 * @fileoverview upload.di.ts
 * @description chat/message-flow/upload｜依赖组装（DI）：upload.di。
 */

import type { FileServicePort } from "@/shared/file-transfer/fileServicePort";
import { getChatUploadFileServicePort } from "@/features/chat/composition/chat.di";
import { GetDownloadUrl } from "@/shared/file-transfer/usecases/GetDownloadUrl";
import { PerformFileUpload } from "@/shared/file-transfer/usecases/PerformFileUpload";
import { RequestFileUpload } from "@/shared/file-transfer/usecases/RequestFileUpload";

let fileServicePort: FileServicePort | null = null;

// ============================================================================
// Ports
// ============================================================================

/**
 * 获取 `FileServicePort`（单例）。
 *
 * 选择规则：
 * - `USE_MOCK_TRANSPORT=true`：使用真实 HTTP 适配器（便于协议层联调）。
 * - `IS_STORE_MOCK=true`：使用内存 mock（用于 UI 预览/开发联调）。
 * - 其它情况：使用真实 HTTP 适配器。
 *
 * @returns `FileServicePort` 实例。
 */
export function getFileServicePort(): FileServicePort {
  if (fileServicePort) return fileServicePort;
  fileServicePort = getChatUploadFileServicePort();
  return fileServicePort;
}

// ============================================================================
// 用例
// ============================================================================

/**
 * 获取 `RequestFileUpload` 用例实例。
 *
 * @returns `RequestFileUpload` 实例。
 */
export function getRequestFileUploadUsecase(): RequestFileUpload {
  return new RequestFileUpload(getFileServicePort());
}

/**
 * 获取 `PerformFileUpload` 用例实例。
 *
 * @returns `PerformFileUpload` 实例。
 */
export function getPerformFileUploadUsecase(): PerformFileUpload {
  return new PerformFileUpload(getFileServicePort());
}

/**
 * 获取 `GetDownloadUrl` 用例实例。
 *
 * @returns `GetDownloadUrl` 实例。
 */
export function getGetDownloadUrlUsecase(): GetDownloadUrl {
  return new GetDownloadUrl(getFileServicePort());
}
