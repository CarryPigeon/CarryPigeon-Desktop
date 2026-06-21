/**
 * @fileoverview files Feature 对外类型。
 */

import type { FileRecord, FileListQuery, FileDeleteRequest, BatchFileRequest, UploaderInfo } from "./domain/contracts";

export type { FileRecord, FileListQuery, FileDeleteRequest, BatchFileRequest, UploaderInfo };

export type FilesCapabilities = {
  listFiles(serverSocket: string, accessToken: string, query: FileListQuery): Promise<FileRecord[]>;
  deleteFile(serverSocket: string, accessToken: string, request: FileDeleteRequest): Promise<void>;
  batchDeleteFiles(serverSocket: string, accessToken: string, request: BatchFileRequest): Promise<void>;
  listUploaders(serverSocket: string, accessToken: string): Promise<UploaderInfo[]>;
};
