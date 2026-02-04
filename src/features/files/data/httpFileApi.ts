/**
 * @fileoverview httpFileApi.ts
 * @description HTTP data adapter for file upload/download flows.
 *
 * API doc reference:
 * - See `docs/api/*` → Files section
 *
 * Notes:
 * - Upload is a two-step flow: request an upload descriptor, then perform the
 *   actual upload directly to `upload.url`.
 * - Download is performed via `/api/files/download/{share_key}` as a binary response.
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";

export type ApiRequestUploadRequest = {
  filename: string;
  mime_type: string;
  size_bytes: number;
  sha256?: string;
};

export type ApiUploadDescriptor = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  expires_at: number;
};

export type ApiRequestUploadResponse = {
  file_id: string;
  share_key: string;
  upload: ApiUploadDescriptor;
};

/**
 * Create an authenticated HTTP client bound to a server socket and token.
 *
 * @param serverSocket - Server socket string.
 * @param accessToken - Bearer token.
 * @returns HttpJsonClient.
 */
function createAuthedClient(serverSocket: string, accessToken: string): HttpJsonClient {
  const socket = serverSocket.trim();
  const token = accessToken.trim();
  if (!socket) throw new Error("Missing server socket");
  if (!token) throw new Error("Missing access token");
  return new HttpJsonClient({ serverSocket: socket, apiVersion: 1, accessToken: token });
}

/**
 * Request an upload descriptor for a file.
 *
 * @param serverSocket - Server socket.
 * @param accessToken - Access token.
 * @param req - Upload request details.
 * @returns Upload descriptor response.
 */
export async function httpRequestFileUpload(
  serverSocket: string,
  accessToken: string,
  req: ApiRequestUploadRequest,
): Promise<ApiRequestUploadResponse> {
  const client = createAuthedClient(serverSocket, accessToken);
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
 * Perform the actual upload using the provided descriptor.
 *
 * This intentionally does not try to infer content-type; the upload endpoint
 * decides. Callers may include `Content-Type` inside `upload.headers` if required.
 *
 * @param upload - Upload descriptor returned by `httpRequestFileUpload`.
 * @param body - Binary payload (Blob/ArrayBuffer/Uint8Array).
 * @returns Promise<void>
 */
export async function httpPerformFileUpload(
  upload: ApiUploadDescriptor,
  body: Blob | ArrayBuffer | Uint8Array,
): Promise<void> {
  if (USE_MOCK_TRANSPORT) {
    void upload;
    void body;
    return;
  }
  const method = String(upload?.method ?? "PUT").trim().toUpperCase() || "PUT";
  const url = String(upload?.url ?? "").trim();
  if (!url) throw new Error("Missing upload.url");

  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(upload?.headers ?? {})) headers[k] = String(v);

  /**
   * Convert supported binary inputs into a `fetch`-compatible body.
   *
   * @param input - Binary input.
   * @returns Fetch body.
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
 * Build the absolute download URL for a share key.
 *
 * @param serverSocket - Server socket.
 * @param shareKey - File share key.
 * @returns Absolute URL like `https://host/api/files/download/{share_key}`.
 */
export function buildFileDownloadUrl(serverSocket: string, shareKey: string): string {
  const origin = toHttpOrigin(serverSocket.trim());
  if (!origin) return "";
  const key = String(shareKey ?? "").trim();
  if (!key) return "";
  return `${origin}/api/files/download/${encodeURIComponent(key)}`;
}
