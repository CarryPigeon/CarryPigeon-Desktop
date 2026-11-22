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
import { ApiRequestError, unwrapApiResponse } from "@/shared/net/http/apiErrors";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { handleProtocolMockApiRequest } from "@/shared/mock/protocol/protocolMockTransport";
import { buildFileDownloadUrl } from "@/shared/file-transfer/buildFileDownloadUrl";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { getDevProxiedApiBaseUrl, shouldUseDevApiProxy } from "@/shared/net/http/devApiProxy";

/**
 * 请求文件上传的参数。
 */
export type ApiRequestUploadRequest = {
  filename: string;
  size_bytes: number;
  sha256: string;
};

/**
 * 上传 descriptor：告诉客户端“怎么上传到上传端点”。
 */
export type ApiUploadDescriptor = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  expires_at: number;
  has_same: boolean;
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
  const sizeBytes = req?.size_bytes;
  const sha256 = String(req?.sha256 ?? "").trim().toLowerCase();
  if (!filename) throw new Error("Missing filename");
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new Error("Invalid size_bytes");
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("Invalid sha256");

  return client.requestJson<ApiRequestUploadResponse>("POST", "/files/uploads", {
    filename,
    size_bytes: sizeBytes,
    sha256,
  });
}

/**
 * 使用 upload descriptor 执行实际上传。
 *
 * 说明：
 * - 优先使用上传描述符中的 Content-Type，缺省时使用文件类型或通用二进制类型。
 * - 上传端点 `/api/files/uploads/{shareKey}` 受 Bearer 鉴权保护，必须附加 `Authorization` header。
 *
 * @param serverSocket - 服务端 socket，用于推导期望 origin。
 * @param accessToken - Bearer access token，附加到 `Authorization` header。
 * @param upload - `httpRequestFileUpload` 返回的 upload descriptor。
 * @param body - 二进制载荷（Blob/ArrayBuffer/Uint8Array）。
 * @returns Promise<void>。
 */
export async function httpPerformFileUpload(
  serverSocket: string,
  accessToken: string,
  upload: ApiUploadDescriptor,
  body: Blob | ArrayBuffer | Uint8Array,
): Promise<void> {
  const method = String(upload?.method ?? "").trim().toUpperCase();
  if (method !== "PUT") throw new Error("Invalid upload.method");
  const url = resolveUploadUrl(serverSocket, upload?.url ?? "");
  if (!url) throw new Error("Invalid upload.url");

  const headers: Record<string, string> = {};
  let contentType = body instanceof Blob ? body.type : "";
  for (const [name, value] of Object.entries(upload?.headers ?? {})) {
    switch (name.trim().toLowerCase()) {
      case "content-length": // WebView 根据固定长度的请求体生成该受限请求头。
      case "authorization":
      case "proxy-authorization":
        break;
      case "content-type":
        contentType = value;
        break;
      default:
        headers[name] = value;
    }
  }
  headers["Content-Type"] = contentType || "application/octet-stream";
  const token = String(accessToken ?? "").trim();
  if (!token) throw new Error("Missing access token");
  headers.Authorization = `Bearer ${token}`;

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

  const requestBody = toFetchBody(body);
  if (USE_MOCK_TRANSPORT) {
    const path = new URL(url).pathname.replace(/^\/api(?=\/)/, "");
    const res = await handleProtocolMockApiRequest({ serverSocket, method, path, headers, body: requestBody });
    if (!res.ok) throw new ApiRequestError(res.error);
    unwrapApiResponse(res.body, res.status);
    return;
  }

  const target = new URL(url);
  const requestUrl = target.pathname.startsWith("/api/") && shouldUseDevApiProxy(serverSocket)
    ? `${getDevProxiedApiBaseUrl()}${target.pathname.slice(4)}${target.search}`
    : url;
  const res = await fetch(requestUrl, {
    method,
    headers,
    body: requestBody,
    redirect: "error",
  });
  const payload: unknown = await res.json().catch(() => null);
  unwrapApiResponse(payload, res.status);
  if (
    !payload || typeof payload !== "object" ||
    !("code" in payload) || payload.code !== 0 ||
    !("message" in payload) || typeof payload.message !== "string" ||
    !("data" in payload) || payload.data !== null
  ) {
    throw new Error(`Invalid upload response: HTTP ${res.status}`);
  }
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
