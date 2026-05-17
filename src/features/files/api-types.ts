/**
 * @fileoverview files Feature 对外类型。
 */

import type { FileRecord, FileListQuery } from "./domain/contracts";

export type { FileRecord, FileListQuery };

export type FilesCapabilities = {
  listFiles(serverSocket: string, accessToken: string, query: FileListQuery): Promise<FileRecord[]>;
};
