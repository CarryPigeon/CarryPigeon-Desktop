/**
 * @fileoverview httpFileListPort.ts
 * @description files/data｜HTTP 文件列表及操作数据适配器。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import { isApiRequestError } from "@/shared/net/http/apiErrors";
import { createLogger } from "@/shared/utils/logger";
import type { FileRecord, FileListQuery, FileDeleteRequest, BatchFileRequest, UploaderInfo } from "../domain/contracts";

const logger = createLogger("httpFileListPort");

type FileRecordWire = {
  id: string;
  share_key: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploader_id?: string;
  uploader_name?: string;
  channel_id?: string;
  channel_name?: string;
};

type ApiListFilesResponse = {
  items: FileRecordWire[];
};

type UploaderWire = {
  id: string;
  name: string;
};

type ApiUploadersResponse = {
  items: UploaderWire[];
};

function mapFileRecordWire(wire: FileRecordWire): FileRecord {
  return {
    id: wire.id,
    shareKey: wire.share_key,
    filename: wire.filename,
    mimeType: wire.mime_type,
    sizeBytes: wire.size_bytes,
    uploadedAt: wire.uploaded_at,
    uploaderId: wire.uploader_id,
    uploaderName: wire.uploader_name,
    channelId: wire.channel_id,
    channelName: wire.channel_name,
  };
}

/**
 * CarryPigeon-Server 当前只提供上传申请/下载，没有文件库列表接口。
 * 404 视为“服务端未实现该能力”，列表类接口返回空，避免真实联调时把文件管理页打成硬错误。
 */
function isMissingFileLibraryEndpoint(error: unknown): boolean {
  return isApiRequestError(error) && (error.status === 404 || error.reason === "not_found");
}

export async function httpListFiles(serverSocket: string, accessToken: string, query: FileListQuery): Promise<FileRecord[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const q: string[] = [];
  if (query.search) q.push(`search=${encodeURIComponent(query.search)}`);
  if (query.mimePrefix) q.push(`mime_prefix=${encodeURIComponent(query.mimePrefix)}`);
  if (query.offset != null) q.push(`offset=${encodeURIComponent(String(Math.max(0, Math.trunc(query.offset))))}`);
  if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.trunc(query.limit))))}`);
  if (query.sortBy) q.push(`sort_by=${encodeURIComponent(query.sortBy)}`);
  if (query.sortOrder) q.push(`sort_order=${encodeURIComponent(query.sortOrder)}`);
  if (query.uploaderId) q.push(`uploader_id=${encodeURIComponent(query.uploaderId)}`);
  if (query.dateFrom) q.push(`date_from=${encodeURIComponent(query.dateFrom)}`);
  if (query.dateTo) q.push(`date_to=${encodeURIComponent(query.dateTo)}`);
  const path = `/files/list${q.length ? `?${q.join("&")}` : ""}`;
  try {
    const res = await client.requestJson<ApiListFilesResponse>("GET", path);
    return Array.isArray(res?.items) ? res.items.map(mapFileRecordWire) : [];
  } catch (error) {
    if (isMissingFileLibraryEndpoint(error)) {
      logger.warn("Action: files_list_endpoint_missing", { path });
      return [];
    }
    throw error;
  }
}

export async function httpDeleteFile(serverSocket: string, accessToken: string, request: FileDeleteRequest): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  try {
    await client.requestJson("POST", "/files/delete", { file_id: request.fileId, share_key: request.shareKey });
  } catch (error) {
    if (isMissingFileLibraryEndpoint(error)) {
      throw new Error("This server does not support file library deletion.");
    }
    throw error;
  }
}

export async function httpBatchDeleteFiles(serverSocket: string, accessToken: string, request: BatchFileRequest): Promise<void> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  try {
    await client.requestJson("POST", "/files/batch-delete", { file_ids: request.fileIds });
  } catch (error) {
    if (isMissingFileLibraryEndpoint(error)) {
      throw new Error("This server does not support file library deletion.");
    }
    throw error;
  }
}

export async function httpListUploaders(serverSocket: string, accessToken: string): Promise<UploaderInfo[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  try {
    const res = await client.requestJson<ApiUploadersResponse>("GET", "/files/uploaders");
    return Array.isArray(res?.items) ? res.items : [];
  } catch (error) {
    if (isMissingFileLibraryEndpoint(error)) {
      logger.warn("Action: files_uploaders_endpoint_missing", {});
      return [];
    }
    throw error;
  }
}
