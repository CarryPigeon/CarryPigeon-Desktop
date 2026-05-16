/**
 * @fileoverview fileServices.ts
 * @description files/composition｜DI 装配 — 选择文件列表数据源。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { mockListFiles } from "../data/mock/mockFileListPort";
import type { FileRecord, FileListQuery } from "../domain/contracts";

export type FileListPort = (serverSocket: string, query: FileListQuery) => Promise<FileRecord[]>;

let fileListPort: FileListPort | null = null;

function createFileListPort(): FileListPort {
  return selectByMockMode<FileListPort>({
    off: () => async (_serverSocket: string, _query: FileListQuery) => [],
    store: () => mockListFiles,
    protocol: () => async (_serverSocket: string, _query: FileListQuery) => [],
  });
}

export function getFileListPort(): FileListPort {
  fileListPort ??= createFileListPort();
  return fileListPort;
}
