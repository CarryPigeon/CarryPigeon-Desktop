/**
 * @fileoverview files Feature 对外公共 API。
 */

import type { FilesCapabilities } from "./api-types";
import { getFileListPort, getFileDeletePort, getFileBatchDeletePort, getFileListUploadersPort } from "./composition/fileServices";

let filesCapabilities: FilesCapabilities | null = null;

export function createFilesCapabilities(): FilesCapabilities {
  return {
    listFiles: getFileListPort(),
    deleteFile: getFileDeletePort(),
    batchDeleteFiles: getFileBatchDeletePort(),
    listUploaders: getFileListUploadersPort(),
  };
}

export function getFilesCapabilities(): FilesCapabilities {
  filesCapabilities ??= createFilesCapabilities();
  return filesCapabilities;
}
