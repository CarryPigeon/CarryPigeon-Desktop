/**
 * @fileoverview 带鉴权的二进制拉取。
 * @description
 * 服务端 `GET /api/files/download/{share_key}` 在对象存储开启时返回 302 预签名地址。
 * 跟随重定向时不得把 Bearer 带到 MinIO，否则会触发 multiple authentication types。
 */

import { ApiRequestError, parseApiErrorEnvelope } from "@/shared/net/http/apiErrors";

async function readDownloadBody(response: Response): Promise<Blob> {
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new ApiRequestError(parseApiErrorEnvelope(payload, response.status));
  }
  return response.blob();
}

/**
 * 拉取受 Bearer 保护的下载入口，并在 3xx 时无鉴权跟随 Location。
 *
 * @param url - 同源下载 URL。
 * @param token - Access token；可为空（例如公开服务端头像）。
 * @returns 最终响应的 Blob。
 */
export async function fetchAuthedBinary(url: string, token: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const accessToken = String(token ?? "").trim();
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const first = await fetch(url, { headers, redirect: "manual" });
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("Location") || first.headers.get("location");
    if (!location) throw new Error(`HTTP ${first.status} redirect missing Location`);
    const nextUrl = new URL(location, url).toString();
    return readDownloadBody(await fetch(nextUrl));
  }
  return readDownloadBody(first);
}
