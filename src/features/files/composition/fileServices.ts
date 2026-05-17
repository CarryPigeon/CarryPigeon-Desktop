/**
 * @fileoverview fileServices.ts
 * @description files/composition｜DI 装配 — 选择文件列表数据源。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { mockListFiles } from "../data/mock/mockFileListPort";
import { httpListFiles } from "../data/httpFileListPort";
import type { FileRecord, FileListQuery } from "../domain/contracts";

export type FileListPort = (serverSocket: string, accessToken: string, query: FileListQuery) => Promise<FileRecord[]>;

let fileListPort: FileListPort | null = null;

function createFileListPort(): FileListPort {
  return selectByMockMode<FileListPort>({
    off: () => async (_serverSocket: string, _accessToken: string, _query: FileListQuery) => [],
    store: () => mockListFiles,
    protocol: () => httpListFiles,
  });
}

export function getFileListPort(): FileListPort {
  fileListPort ??= createFileListPort();
  return fileListPort;
}
