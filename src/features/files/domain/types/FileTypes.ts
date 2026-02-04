/**
 * @fileoverview FileTypes.ts
 * @description Domain types for file operations.
 */

/**
 * File upload request.
 */
export type FileUploadRequest = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
};

/**
 * Upload descriptor (where and how to upload).
 */
export type UploadDescriptor = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  expiresAt: number;
};

/**
 * File upload result.
 */
export type FileUploadResult = {
  fileId: string;
  shareKey: string;
  upload: UploadDescriptor;
};
