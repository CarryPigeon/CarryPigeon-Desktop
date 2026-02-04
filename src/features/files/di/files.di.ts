/**
 * @fileoverview files.di.ts
 * @description Composition root for files feature.
 */

import { USE_MOCK_API, USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
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
 * Get singleton FileServicePort.
 *
 * @returns FileServicePort.
 */
export function getFileServicePort(): FileServicePort {
  if (fileServicePort) return fileServicePort;
  fileServicePort = USE_MOCK_TRANSPORT ? httpFileServicePort : USE_MOCK_API ? mockFileServicePort : httpFileServicePort;
  return fileServicePort;
}

// ============================================================================
// Usecases
// ============================================================================

/**
 * Get RequestFileUpload usecase.
 *
 * @returns RequestFileUpload usecase instance.
 */
export function getRequestFileUploadUsecase(): RequestFileUpload {
  return new RequestFileUpload(getFileServicePort());
}

/**
 * Get PerformFileUpload usecase.
 *
 * @returns PerformFileUpload usecase instance.
 */
export function getPerformFileUploadUsecase(): PerformFileUpload {
  return new PerformFileUpload(getFileServicePort());
}

/**
 * Get GetDownloadUrl usecase.
 *
 * @returns GetDownloadUrl usecase instance.
 */
export function getGetDownloadUrlUsecase(): GetDownloadUrl {
  return new GetDownloadUrl(getFileServicePort());
}
