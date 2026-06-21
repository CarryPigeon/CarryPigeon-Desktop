/**
 * @fileoverview files/domain/contracts.ts
 * @description 文件管理模块的领域类型定义。
 */

export interface FileRecord {
  id: string;
  shareKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  uploaderId?: string;
  uploaderName?: string;
  channelId?: string;
  channelName?: string;
}

export type FileSortField = "filename" | "sizeBytes" | "uploadedAt";
export type SortOrder = "asc" | "desc";

export interface FileListQuery {
  search?: string;
  mimePrefix?: string;
  offset?: number;
  limit?: number;
  sortBy?: FileSortField;
  sortOrder?: SortOrder;
  uploaderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FileDeleteRequest {
  fileId: string;
  shareKey: string;
}

export interface BatchFileRequest {
  fileIds: string[];
}

export interface UploaderInfo {
  id: string;
  name: string;
}
