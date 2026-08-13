/**
 * @fileoverview 浏览器 Vite 预览下的本地 API 反向代理辅助。
 * @description
 * CarryPigeon-Server 的 Bearer 拦截器会处理 CORS 预检 OPTIONS，导致受保护接口
 * （例如 `GET /api/channels`）预检返回 500，浏览器因此拦下真正的请求。
 *
 * Tauri 桌面端可走 reqwest，不受该 CORS 预检影响。浏览器 `pnpm run dev` 预览
 * 则把指向本机默认 HTTP 端口的 `/api` 改写到当前页面 origin，由 Vite 代理到
 * 真实服务端，从而绕过跨 Origin 预检。
 */

import { isTauriRuntimeAvailable } from "@/shared/tauri/runtime";
import { toHttpOrigin } from "./serverOrigin";

/** 与 CarryPigeon-Server 默认 `server.port` 对齐的 Vite HTTP 代理目标。 */
export const DEFAULT_DEV_API_PROXY_TARGET = "http://127.0.0.1:8080";

/**
 * 读取开发态 HTTP 代理目标 origin。
 *
 * @returns 例如 `http://127.0.0.1:8080`。
 */
export function getDevApiProxyTargetOrigin(): string {
  const raw = String(import.meta.env.VITE_DEV_API_PROXY_TARGET ?? DEFAULT_DEV_API_PROXY_TARGET).trim();
  try {
    return new URL(raw).origin;
  } catch {
    return DEFAULT_DEV_API_PROXY_TARGET;
  }
}

/**
 * 判断是否应将本机联调请求改写到 Vite 页面 origin。
 *
 * @param serverSocket - 用户配置的 server socket。
 * @param options - 可注入的运行时上下文（便于单测）。
 * @returns 需要走开发代理时为 true。
 */
export function shouldUseDevApiProxy(
  serverSocket: string,
  options?: { pageOrigin?: string; isTauri?: boolean; isDev?: boolean },
): boolean {
  const isDev = options?.isDev ?? import.meta.env.DEV;
  if (!isDev) return false;
  const isTauri = options?.isTauri ?? isTauriRuntimeAvailable();
  if (isTauri) return false;

  const pageOrigin = options?.pageOrigin ?? readPageOrigin();
  if (!pageOrigin) return false;

  const targetOrigin = toHttpOrigin(serverSocket);
  if (!targetOrigin) return false;
  if (targetOrigin === pageOrigin) return false;

  let page: URL;
  let target: URL;
  try {
    page = new URL(pageOrigin);
    target = new URL(targetOrigin);
  } catch {
    return false;
  }
  if (!isLoopbackHost(page.hostname) || !isLoopbackHost(target.hostname)) return false;
  return isSameLoopbackHttpTarget(target, getDevApiProxyTargetOrigin());
}

/**
 * 当前页面 origin 上的 `/api` 前缀（由 Vite 代理到真实服务端）。
 *
 * @param pageOrigin - 可选页面 origin；缺省读取 `window.location.origin`。
 * @returns 例如 `http://127.0.0.1:1420/api`。
 */
export function getDevProxiedApiBaseUrl(pageOrigin?: string): string {
  const origin = (pageOrigin ?? readPageOrigin()).replace(/\/+$/, "");
  if (!origin) return "";
  return `${origin}/api`;
}

/**
 * 当前页面 origin 上的 WS 入口（由 Vite 代理到服务端 realtime 端口）。
 *
 * @param pageOrigin - 可选页面 origin；缺省读取 `window.location.origin`。
 * @returns 例如 `ws://127.0.0.1:1420/api/ws`。
 */
export function getDevProxiedWsUrl(pageOrigin?: string): string {
  const origin = pageOrigin ?? readPageOrigin();
  if (!origin) return "";
  try {
    const page = new URL(origin);
    const wsProtocol = page.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${page.host}/api/ws`;
  } catch {
    return "";
  }
}

/**
 * 读取当前页面 origin。
 *
 * @returns origin 字符串；非浏览器环境返回空。
 */
function readPageOrigin(): string {
  if (typeof window === "undefined") return "";
  return String(window.location?.origin ?? "").trim();
}

/**
 * 判断主机是否为本机回环地址。
 *
 * @param host - 主机名。
 * @returns 回环时为 true。
 */
function isLoopbackHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
}

/**
 * 判断目标 origin 是否与开发代理配置的本机 HTTP 服务一致（localhost 与 127.0.0.1 视为同一主机）。
 *
 * @param target - 已解析的登录 origin。
 * @param proxyTargetOrigin - `VITE_DEV_API_PROXY_TARGET` 的 origin。
 * @returns 匹配时代理生效。
 */
function isSameLoopbackHttpTarget(target: URL, proxyTargetOrigin: string): boolean {
  try {
    const configured = new URL(proxyTargetOrigin);
    if (target.protocol !== configured.protocol) return false;
    if (!isLoopbackHost(configured.hostname)) return target.origin === configured.origin;
    return originPort(target) === originPort(configured);
  } catch {
    return false;
  }
}

/**
 * 读取 URL 的有效端口。
 *
 * @param url - 已解析 URL。
 * @returns 端口字符串。
 */
function originPort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : "80";
}
