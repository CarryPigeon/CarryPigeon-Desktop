/**
 * @fileoverview files.di.ts
 * @description files｜依赖组装（DI）：files.di。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import type { FileServicePort } from "../domain/ports/FileServicePort";
import { httpFileServicePort } from "../data/httpFileServicePort";
import { mockFileServicePort } from "../mock/mockFileServicePort";
import { RequestFileUpload } from "../domain/usecases/RequestFileUpload";
import { PerformFileUpload } from "../domain/usecases/PerformFileUpload";
import { GetDownloadUrl } from "../domain/usecases/GetDownloadUrl";

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
  fileServicePort = selectByMockMode<FileServicePort>({
    off: () => httpFileServicePort,
    store: () => mockFileServicePort,
    protocol: () => httpFileServicePort,
  });
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
