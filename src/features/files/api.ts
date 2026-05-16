/**
 * @fileoverview files Feature 对外公共 API。
 */

import type { FilesCapabilities } from "./api-types";
import { getFileListPort } from "./composition/fileServices";

let filesCapabilities: FilesCapabilities | null = null;

export function createFilesCapabilities(): FilesCapabilities {
  const port = getFileListPort();
  return {
    listFiles: port,
  };
}

export function getFilesCapabilities(): FilesCapabilities {
  filesCapabilities ??= createFilesCapabilities();
  return filesCapabilities;
}
