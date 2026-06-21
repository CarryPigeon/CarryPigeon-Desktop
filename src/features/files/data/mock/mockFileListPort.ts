/**
 * @fileoverview mockFileListPort.ts
 * @description files/data/mock｜Mock 文件列表数据（扩展版）。
 */

import type { FileRecord, FileListQuery, FileDeleteRequest, BatchFileRequest, UploaderInfo } from "../../domain/contracts";

const INITIAL_MOCK_FILES: FileRecord[] = [
  { id: "f1", shareKey: "sk-img-1", filename: "screenshot.png", mimeType: "image/png", sizeBytes: 245760, uploadedAt: "2026-05-14T10:30:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c1", channelName: "general" },
  { id: "f2", shareKey: "sk-pdf-1", filename: "meeting-notes.pdf", mimeType: "application/pdf", sizeBytes: 1048576, uploadedAt: "2026-05-13T14:20:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c2", channelName: "dev" },
  { id: "f3", shareKey: "sk-doc-1", filename: "spec-v2.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 512000, uploadedAt: "2026-05-12T09:15:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c1", channelName: "general" },
  { id: "f4", shareKey: "sk-zip-1", filename: "assets.zip", mimeType: "application/zip", sizeBytes: 8388608, uploadedAt: "2026-05-11T16:45:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c3", channelName: "design" },
  { id: "f5", shareKey: "sk-audio-1", filename: "voice-memo.wav", mimeType: "audio/wav", sizeBytes: 3145728, uploadedAt: "2026-05-10T11:00:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c1", channelName: "general" },
  { id: "f6", shareKey: "sk-vid-1", filename: "demo-recording.mp4", mimeType: "video/mp4", sizeBytes: 15728640, uploadedAt: "2026-05-09T08:30:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c2", channelName: "dev" },
  { id: "f7", shareKey: "sk-img-2", filename: "logo.png", mimeType: "image/png", sizeBytes: 65536, uploadedAt: "2026-05-08T12:00:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c1", channelName: "general" },
  { id: "f8", shareKey: "sk-img-3", filename: "banner.jpg", mimeType: "image/jpeg", sizeBytes: 2097152, uploadedAt: "2026-05-07T09:45:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c3", channelName: "design" },
  { id: "f9", shareKey: "sk-pdf-2", filename: "annual-report-2025.pdf", mimeType: "application/pdf", sizeBytes: 5242880, uploadedAt: "2026-05-06T15:30:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c1", channelName: "general" },
  { id: "f10", shareKey: "sk-doc-2", filename: "onboarding-guide.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 204800, uploadedAt: "2026-05-05T10:00:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c2", channelName: "dev" },
  { id: "f11", shareKey: "sk-zip-2", filename: "source-code.tar.gz", mimeType: "application/gzip", sizeBytes: 10485760, uploadedAt: "2026-05-04T14:00:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c2", channelName: "dev" },
  { id: "f12", shareKey: "sk-audio-2", filename: "podcast-ep1.mp3", mimeType: "audio/mpeg", sizeBytes: 8388608, uploadedAt: "2026-05-03T08:00:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c1", channelName: "general" },
  { id: "f13", shareKey: "sk-vid-2", filename: "tutorial-part1.mp4", mimeType: "video/mp4", sizeBytes: 52428800, uploadedAt: "2026-05-02T11:30:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c2", channelName: "dev" },
  { id: "f14", shareKey: "sk-img-4", filename: "icon.svg", mimeType: "image/svg+xml", sizeBytes: 8192, uploadedAt: "2026-05-01T16:00:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c3", channelName: "design" },
  { id: "f15", shareKey: "sk-txt-1", filename: "README.md", mimeType: "text/markdown", sizeBytes: 12288, uploadedAt: "2026-04-30T09:00:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c1", channelName: "general" },
  { id: "f16", shareKey: "sk-txt-2", filename: "CHANGELOG.txt", mimeType: "text/plain", sizeBytes: 4096, uploadedAt: "2026-04-29T13:00:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c2", channelName: "dev" },
  { id: "f17", shareKey: "sk-pdf-3", filename: "architecture-overview.pdf", mimeType: "application/pdf", sizeBytes: 3145728, uploadedAt: "2026-04-28T10:30:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c1", channelName: "general" },
  { id: "f18", shareKey: "sk-img-5", filename: "photo-heic.heic", mimeType: "image/heic", sizeBytes: 4194304, uploadedAt: "2026-04-27T15:45:00Z", uploaderId: "u3", uploaderName: "Charlie", channelId: "c3", channelName: "design" },
  { id: "f19", shareKey: "sk-zip-3", filename: "backup-2026-04.zip", mimeType: "application/zip", sizeBytes: 209715200, uploadedAt: "2026-04-26T23:00:00Z", uploaderId: "u1", uploaderName: "Alice", channelId: "c1", channelName: "general" },
  { id: "f20", shareKey: "sk-audio-3", filename: "interview.mp4", mimeType: "video/mp4", sizeBytes: 104857600, uploadedAt: "2026-04-25T08:15:00Z", uploaderId: "u2", uploaderName: "Bob", channelId: "c2", channelName: "dev" },
];

/** 可变工作副本，用于模拟有状态操作（增删改）。 */
let MOCK_FILES: FileRecord[] = [...INITIAL_MOCK_FILES];

/** 重置 mock 数据到初始状态（测试 teardown 时调用）。 */
export function resetMockFiles(): void {
  MOCK_FILES = [...INITIAL_MOCK_FILES];
}

const MOCK_UPLOADERS: UploaderInfo[] = [
  { id: "u1", name: "Alice" },
  { id: "u2", name: "Bob" },
  { id: "u3", name: "Charlie" },
];

function sortFiles(files: FileRecord[], sortBy?: string, sortOrder?: string): FileRecord[] {
  if (!sortBy) return files;
  const order = sortOrder === "asc" ? 1 : -1;
  return [...files].sort((a, b) => {
    const aVal = a[sortBy as keyof FileRecord];
    const bVal = b[sortBy as keyof FileRecord];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * order;
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * order;
    }
    return 0;
  });
}

export async function mockListFiles(_serverSocket: string, _accessToken: string, query: FileListQuery): Promise<FileRecord[]> {
  let results = [...MOCK_FILES];

  if (query.search) {
    const keyword = query.search.toLowerCase();
    results = results.filter((f) => f.filename.toLowerCase().includes(keyword));
  }

  if (query.mimePrefix) {
    results = results.filter((f) => f.mimeType.startsWith(query.mimePrefix!));
  }

  if (query.uploaderId) {
    results = results.filter((f) => f.uploaderId === query.uploaderId);
  }

  if (query.dateFrom) {
    const from = new Date(query.dateFrom).getTime();
    results = results.filter((f) => new Date(f.uploadedAt).getTime() >= from);
  }

  if (query.dateTo) {
    const to = new Date(query.dateTo).getTime();
    results = results.filter((f) => new Date(f.uploadedAt).getTime() <= to);
  }

  results = sortFiles(results, query.sortBy, query.sortOrder);

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  results = results.slice(offset, offset + limit);

  await new Promise((r) => setTimeout(r, 300));
  return results;
}

export async function mockDeleteFile(_serverSocket: string, _accessToken: string, request: FileDeleteRequest): Promise<void> {
  MOCK_FILES = MOCK_FILES.filter((f) => f.id !== request.fileId);
  await new Promise((r) => setTimeout(r, 200));
}

export async function mockBatchDeleteFiles(_serverSocket: string, _accessToken: string, request: BatchFileRequest): Promise<void> {
  const idSet = new Set(request.fileIds);
  MOCK_FILES = MOCK_FILES.filter((f) => !idSet.has(f.id));
  await new Promise((r) => setTimeout(r, 300));
}

export async function mockListUploaders(_serverSocket: string, _accessToken: string): Promise<UploaderInfo[]> {
  return MOCK_UPLOADERS;
}
