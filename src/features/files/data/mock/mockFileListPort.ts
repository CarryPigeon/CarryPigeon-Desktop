/**
 * @fileoverview mockFileListPort.ts
 * @description files/data/mock｜Mock 文件列表数据。
 */

import type { FileRecord, FileListQuery } from "../../domain/contracts";

const MOCK_FILES: FileRecord[] = [
  { id: "f1", shareKey: "sk-img-1", filename: "screenshot.png", mimeType: "image/png", sizeBytes: 245760, uploadedAt: "2026-05-14T10:30:00Z", uploaderName: "Alice", channelName: "general" },
  { id: "f2", shareKey: "sk-pdf-1", filename: "meeting-notes.pdf", mimeType: "application/pdf", sizeBytes: 1048576, uploadedAt: "2026-05-13T14:20:00Z", uploaderName: "Bob", channelName: "dev" },
  { id: "f3", shareKey: "sk-doc-1", filename: "spec-v2.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", sizeBytes: 512000, uploadedAt: "2026-05-12T09:15:00Z", uploaderName: "Alice", channelName: "general" },
  { id: "f4", shareKey: "sk-zip-1", filename: "assets.zip", mimeType: "application/zip", sizeBytes: 8388608, uploadedAt: "2026-05-11T16:45:00Z", uploaderName: "Charlie", channelName: "design" },
  { id: "f5", shareKey: "sk-audio-1", filename: "voice-memo.wav", mimeType: "audio/wav", sizeBytes: 3145728, uploadedAt: "2026-05-10T11:00:00Z", uploaderName: "Bob", channelName: "general" },
  { id: "f6", shareKey: "sk-vid-1", filename: "demo-recording.mp4", mimeType: "video/mp4", sizeBytes: 15728640, uploadedAt: "2026-05-09T08:30:00Z", uploaderName: "Charlie", channelName: "dev" },
];

export async function mockListFiles(_serverSocket: string, _accessToken: string, query: FileListQuery): Promise<FileRecord[]> {
  let results = [...MOCK_FILES];

  if (query.search) {
    const keyword = query.search.toLowerCase();
    results = results.filter((f) => f.filename.toLowerCase().includes(keyword));
  }

  if (query.mimePrefix) {
    results = results.filter((f) => f.mimeType.startsWith(query.mimePrefix!));
  }

  const offset = query.offset ?? 0;
  const limit = query.limit ?? 50;
  results = results.slice(offset, offset + limit);

  await new Promise((r) => setTimeout(r, 300));
  return results;
}
