/**
 * @fileoverview readLocalFileAsBlob.ts
 * @description 把 Tauri 侧本地文件路径分块读取为前端 Blob。
 *
 * 通过 `read_file_base64_chunk` 循环读取，避免单条 IPC 载荷过大，
 * 同时绕开一次性 base64 解码整张大文件带来的内存尖峰。
 */

import { invokeTauri } from "@/shared/tauri/invokeClient";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";

const DEFAULT_CHUNK_SIZE = 256 * 1024;

export interface FileChunkResponse {
  /** Base64 编码的文件片段。 */
  chunk: string;
  /** 本次实际读取的字节数。 */
  read_bytes: number;
  /** 文件总字节数。 */
  total_bytes: number;
  /** 是否已读到文件末尾。 */
  eof: boolean;
}

/**
 * 将 Base64 字符串转换为 Uint8Array。
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 分块读取本地文件并组装为 Blob。
 *
 * @param path - 本地文件绝对路径。
 * @param type - 目标 Blob MIME 类型。
 * @param chunkSize - 单次读取字节数上限（默认 256KB）。
 * @returns 组装后的 Blob。
 */
export async function readLocalFileAsBlob(
  path: string,
  type?: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<Blob> {
  const parts: Uint8Array[] = [];
  let offset = 0;

  while (true) {
    const res = await invokeTauri<FileChunkResponse>(TAURI_COMMANDS.readFileBase64Chunk, {
      path,
      offset,
      length: chunkSize,
    });

    if (res.read_bytes > 0) {
      parts.push(base64ToUint8Array(res.chunk));
      offset += res.read_bytes;
    }

    if (res.eof || res.read_bytes === 0) {
      break;
    }
  }

  return new Blob(parts as BlobPart[], { type });
}
