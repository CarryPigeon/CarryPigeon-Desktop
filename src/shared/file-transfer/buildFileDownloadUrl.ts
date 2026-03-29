/**
 * @fileoverview 文件下载 URL 构建工具。
 * @description
 * 提供跨 feature 可复用的 share-key 下载 URL 构建能力。
 */

import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { buildProtocolMockDownloadUrl } from "@/shared/mock/protocol/protocolMockTransport";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";

/**
 * 构建 share key 对应的绝对下载 URL。
 *
 * @param serverSocket - 服务端 socket。
 * @param shareKey - 文件 share key。
 * @returns 绝对 URL（无法构建时返回空字符串）。
 */
export function buildFileDownloadUrl(serverSocket: string, shareKey: string): string {
  const socket = serverSocket.trim();
  const key = String(shareKey ?? "").trim();
  if (!socket || !key) return "";
  if (USE_MOCK_TRANSPORT) return buildProtocolMockDownloadUrl(socket, key);
  const origin = toHttpOrigin(socket);
  if (!origin) return "";
  return `${origin}/api/files/download/${encodeURIComponent(key)}`;
}

