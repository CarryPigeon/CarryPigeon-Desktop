/**
 * @fileoverview httpFileApi.ts
 * @description shared/file-transfer｜数据层实现：httpFileApi。
 *
 * API 文档：
 * - 见 `docs/api/*` → Files 相关接口
 *
 * 说明：
 * - 上传为两段式：先请求 upload descriptor，再将文件直接上传到 `upload.url`。
 * - 下载通过 `/api/files/download/{share_key}` 以二进制响应完成。
 */

import { createAuthedHttpJsonClient } from "@/shared/net/http/authedHttpJsonClient";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { buildFileDownloadUrl } from "@/shared/file-transfer/buildFileDownloadUrl";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";

/**
 * 请求文件上传的参数。
 */
export type ApiRequestUploadRequest = {
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256?: string;
};

/**
 * 上传 descriptor：告诉客户端“怎么上传到上传端点”。
 */
export type ApiUploadDescriptor = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  expires_at: number;
};

/**
 * 请求上传响应：返回 file_id/share_key 以及 upload descriptor。
 */
export type ApiRequestUploadResponse = {
  file_id: string;
  share_key: string;
  upload: ApiUploadDescriptor;
};

/**
 * 请求文件上传的 upload descriptor。
 *
 * @param serverSocket - 服务端 socket。
 * @param accessToken - Access token。
 * @param req - 上传请求参数。
 * @returns upload descriptor 响应。
 */
export async function httpRequestFileUpload(
  serverSocket: string,
  accessToken: string,
  req: ApiRequestUploadRequest,
): Promise<ApiRequestUploadResponse> {
  const client = createAuthedHttpJsonClient(serverSocket, accessToken);
  const filename = String(req?.filename ?? "").trim();
  const mimeType = String(req?.mime_type ?? "").trim();
  const sizeBytes = Number(req?.size_bytes ?? 0);
  if (!filename) throw new Error("Missing filename");
  if (!mimeType) throw new Error("Missing mime_type");
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new Error("Invalid size_bytes");

  return client.requestJson<ApiRequestUploadResponse>("POST", "/files/uploads", {
    filename,
    mime_type: mimeType,
    size_bytes: Math.trunc(sizeBytes),
    sha256: String(req?.sha256 ?? "").trim() || undefined,
  });
}

/**
 * 使用 upload descriptor 执行实际上传。
 *
 * 说明：
 * - 该函数不会推断 content-type；由上传端点自行决定。
 * - 若服务端要求，可在 `upload.headers` 中携带 `Content-Type`。
 *
 * @param upload - `httpRequestFileUpload` 返回的 upload descriptor。
 * @param body - 二进制载荷（Blob/ArrayBuffer/Uint8Array）。
 * @returns Promise<void>。
 */
export async function httpPerformFileUpload(
  serverSocket: string,
  upload: ApiUploadDescriptor,
  body: Blob | ArrayBuffer | Uint8Array,
): Promise<void> {
  if (USE_MOCK_TRANSPORT) {
    void serverSocket;
    void upload;
    void body;
    return;
  }
  const method = String(upload?.method ?? "PUT").trim().toUpperCase() || "PUT";
  const url = resolveUploadUrl(serverSocket, upload?.url ?? "");
  if (!url) throw new Error("Invalid upload.url");

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(upload?.headers ?? {})) headers[k] = String(v);

  /**
   * 将支持的二进制输入转换为 `fetch` 可接受的 body。
   *
   * @param input - 二进制输入。
   * @returns `fetch` 可接受的 body。
   */
  function toFetchBody(input: Blob | ArrayBuffer | Uint8Array): Blob | ArrayBuffer {
    if (input instanceof Blob) return input;
    if (input instanceof ArrayBuffer) return input;
    const start = input.byteOffset;
    const end = input.byteOffset + input.byteLength;
    const buf = input.buffer;
    if (buf instanceof ArrayBuffer) return buf.slice(start, end);
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    return copy.buffer;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: toFetchBody(body),
  });
  if (!res.ok) throw new Error(`Upload failed: HTTP ${res.status}`);
}

/**
 * 解析并约束 upload URL 到期望的 server origin。
 *
 * 规则：
 * - 相对 URL 会确定性地解析为 `expectedOrigin` 下的绝对 URL；
 * - 绝对 URL 只有在 origin 与 `expectedOrigin` 完全一致时才允许；
 * - 其它情况一律拒绝。
 *
 * @param serverSocket - 服务端 socket，用于推导期望 origin。
 * @param uploadUrl - 服务端返回的 upload URL。
 * @returns 允许的绝对 URL；不符合约束时返回空字符串。
 */
export function resolveUploadUrl(serverSocket: string, uploadUrl: string): string {
  const expectedOrigin = toHttpOrigin(serverSocket);
  const rawUrl = String(uploadUrl ?? "").trim();
  if (!expectedOrigin || !rawUrl) return "";
  try {
    const resolved = new URL(rawUrl, expectedOrigin);
    return resolved.origin === expectedOrigin ? resolved.href : "";
  } catch {
    return "";
  }
}

export { buildFileDownloadUrl };
