/**
 * @fileoverview fileServices.ts
 * @description files/composition｜DI 装配 — 选择文件列表数据源。
 */

import { selectByMockMode } from "@/shared/config/mockModeSelector";
import { mockListFiles, mockDeleteFile, mockBatchDeleteFiles, mockListUploaders } from "../data/mock/mockFileListPort";
import { httpListFiles, httpDeleteFile, httpBatchDeleteFiles, httpListUploaders } from "../data/httpFileListPort";
import type { FileRecord, FileListQuery, FileDeleteRequest, BatchFileRequest, UploaderInfo } from "../domain/contracts";

export type FileListPort = (serverSocket: string, accessToken: string, query: FileListQuery) => Promise<FileRecord[]>;
export type FileDeletePort = (serverSocket: string, accessToken: string, request: FileDeleteRequest) => Promise<void>;
export type FileBatchDeletePort = (serverSocket: string, accessToken: string, request: BatchFileRequest) => Promise<void>;
export type FileListUploadersPort = (serverSocket: string, accessToken: string) => Promise<UploaderInfo[]>;

let fileListPort: FileListPort | null = null;
let fileDeletePort: FileDeletePort | null = null;
let fileBatchDeletePort: FileBatchDeletePort | null = null;
let fileListUploadersPort: FileListUploadersPort | null = null;

function createFileListPort(): FileListPort {
  return selectByMockMode<FileListPort>({
    off: () => httpListFiles,
    store: () => mockListFiles,
    protocol: () => httpListFiles,
  });
}

function createFileDeletePort(): FileDeletePort {
  return selectByMockMode<FileDeletePort>({
    off: () => httpDeleteFile,
    store: () => mockDeleteFile,
    protocol: () => httpDeleteFile,
  });
}

function createFileBatchDeletePort(): FileBatchDeletePort {
  return selectByMockMode<FileBatchDeletePort>({
    off: () => httpBatchDeleteFiles,
    store: () => mockBatchDeleteFiles,
    protocol: () => httpBatchDeleteFiles,
  });
}

function createFileListUploadersPort(): FileListUploadersPort {
  return selectByMockMode<FileListUploadersPort>({
    off: () => httpListUploaders,
    store: () => mockListUploaders,
    protocol: () => httpListUploaders,
  });
}

export function getFileListPort(): FileListPort {
  fileListPort ??= createFileListPort();
  return fileListPort;
}

export function getFileDeletePort(): FileDeletePort {
  fileDeletePort ??= createFileDeletePort();
  return fileDeletePort;
}

export function getFileBatchDeletePort(): FileBatchDeletePort {
  fileBatchDeletePort ??= createFileBatchDeletePort();
  return fileBatchDeletePort;
}

export function getFileListUploadersPort(): FileListUploadersPort {
  fileListUploadersPort ??= createFileListUploadersPort();
  return fileListUploadersPort;
}
