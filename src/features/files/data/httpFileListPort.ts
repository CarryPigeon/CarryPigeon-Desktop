/**
 * @fileoverview httpFileListPort.ts
 * @description files/data｜HTTP 文件列表数据适配器。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import type { FileRecord, FileListQuery } from "../domain/contracts";

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

export async function httpListFiles(serverSocket: string, accessToken: string, query: FileListQuery): Promise<FileRecord[]> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const q: string[] = [];
  if (query.search) q.push(`search=${encodeURIComponent(query.search)}`);
  if (query.mimePrefix) q.push(`mime_prefix=${encodeURIComponent(query.mimePrefix)}`);
  if (query.offset != null) q.push(`offset=${encodeURIComponent(String(Math.max(0, Math.trunc(query.offset))))}`);
  if (query.limit != null) q.push(`limit=${encodeURIComponent(String(Math.max(1, Math.trunc(query.limit))))}`);
  const path = `/api/files/list${q.length ? `?${q.join("&")}` : ""}`;
  const res = await client.requestJson<ApiListFilesResponse>("GET", path);
  return Array.isArray(res?.items) ? res.items.map(mapFileRecordWire) : [];
}
