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

export interface FileListQuery {
  search?: string;
  mimePrefix?: string;
  offset?: number;
  limit?: number;
}
