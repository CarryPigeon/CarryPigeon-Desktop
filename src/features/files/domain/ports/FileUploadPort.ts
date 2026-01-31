/**
 * @fileoverview FileUploadPort.ts 文件职责说明。
 */
export type RequestUploadArgs = {
  serverSocket: string;
  size: number;
  sha256: string;
};

export interface FileUploadPort {
  requestUpload(args: RequestUploadArgs): Promise<void>;
}

