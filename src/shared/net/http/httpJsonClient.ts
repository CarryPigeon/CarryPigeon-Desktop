/**
 * @fileoverview HTTP JSON 客户端（面向 `/api/*`）。
 * @description 网络基础设施：httpJsonClient。
 * 这是一个对 `fetch` 的最小封装，目标是把“跨模块一致的协议细节”收敛到一处：
 * - 自动附加 API 版本 `Accept` 头（`application/vnd.carrypigeon+json; version=1`）
 * - 在有 token 时附加 `Authorization: Bearer ...`
 * - 解析 JSON 成功响应
 * - 将非 2xx 响应归一化为 `ApiRequestError`
 *
 * 设计原则：
 * - 不做完整 SDK（避免过度抽象）；各 feature 的 data adapter 仍应保留自己的 DTO/映射。
 * - 在“自签证书/指纹信任”场景下，WebView `fetch` 无法绕过证书校验，因此会按 TLS 策略选择
 *   走 Tauri(Rust reqwest) 的 `api_request_json` 命令作为替代实现。
 */

import { ApiRequestError, type ApiErrorEnvelope } from "./apiErrors";
import { toHttpOrigin } from "./serverOrigin";
import { createLogger } from "@/shared/utils/logger";
import { USE_MOCK_TRANSPORT } from "@/shared/config/runtime";
import { handleProtocolMockApiRequest } from "@/shared/mock/protocol/protocolMockTransport";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import { buildCarryPigeonAcceptHeader } from "@/shared/net/http/apiHeaders";
import { getServerTlsConfig } from "@/shared/net/tls/serverTlsConfigProvider";

const logger = createLogger("httpJsonClient");

/**
 * HTTP JSON 客户端配置（每次请求的必要上下文）。
 */
export type HttpJsonClientConfig = {
  /**
   * 服务端 socket 原始字符串（用于推导 HTTP origin）。
   */
  serverSocket: string;
  /**
   * 可选 bearer token（access_token）。
   */
  accessToken?: string;
  /**
   * 协议主版本号（用于 `Accept` 头）。
   */
  apiVersion: number;
};

/**
 * 从 server socket 构造稳定的 `/api` base URL。
 *
 * @param serverSocket - 原始 server socket。
 * @returns 例如 `https://host:port/api`（无尾随 `/`）；失败时返回空字符串。
 */
function toApiBaseUrl(serverSocket: string): string {
  const origin = toHttpOrigin(serverSocket);
  if (!origin) return "";
  return `${origin}/api`;
}

type TauriApiResponse = {
  ok: boolean;
  status: number;
  body?: unknown;
  error?: unknown;
};

/**
 * 判断当前请求是否应走 Tauri(Rust) 侧 HTTP 客户端。
 *
 * 仅当用户选择的 TLS 策略无法由 WebView `fetch` 实现时才切换：
 * - 自签证书（insecure）
 * - 指纹信任（trust_fingerprint）
 *
 * @param serverSocket - 服务器 Socket 地址（用于读取 TLS 策略）。
 * @param url - 已构造完成的请求 URL。
 * @returns 当需要使用 Tauri 时返回 `true`。
 */
function shouldUseTauriHttp(serverSocket: string, url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
  } catch {
    return false;
  }
  const tls = getServerTlsConfig(serverSocket);
  return tls.tlsPolicy === "insecure" || tls.tlsPolicy === "trust_fingerprint";
}

/**
 * 通过 Tauri 执行 `/api/*` JSON 请求（遵循 TLS policy）。
 *
 * @param serverSocket - 服务器 Socket 地址（用于读取 TLS 策略）。
 * @param method - HTTP method。
 * @param path - 以 `/` 开头的 API path（例如 `/server`）。
 * @param headers - Header map。
 * @param body - 可选 JSON body。
 * @returns 规范化后的响应对象。
 */
async function tauriRequestJson(
  serverSocket: string,
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<TauriApiResponse> {
  const normalizedPath = normalizeApiPath(path);
  const apiPath = `/api${normalizedPath}`;
  const tls = getServerTlsConfig(serverSocket);
  try {
    const args: Record<string, unknown> = {
      serverSocket,
      method,
      path: apiPath,
      headers,
      tlsPolicy: tls.tlsPolicy,
      tlsFingerprint: tls.tlsFingerprint,
    };
    if (body !== undefined) args.body = body;
    return await invokeTauri<TauriApiResponse>(TAURI_COMMANDS.apiRequestJson, args);
  } catch (e) {
    logger.warn("Action: http_tauri_api_request_json_failed_fallback_to_fetch", { method, path: apiPath, error: String(e) });
    throw e;
  }
}

/**
 * 尝试将响应体解析为 JSON；不支持/失败则返回 `null`。
 *
 * @param res - fetch Response。
 * @returns JSON 值或 `null`。
 */
async function readJsonSafe(res: Response): Promise<unknown | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json") && !ct.includes("application/vnd.carrypigeon+json")) return null;
  try {
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * 将非 2xx 响应归一化为 `ApiRequestError`。
 *
 * @param res - fetch Response。
 * @returns ApiRequestError。
 */
async function toApiError(res: Response): Promise<ApiRequestError> {
  const raw = await readJsonSafe(res);
  if (raw && typeof raw === "object" && "error" in raw) {
    return new ApiRequestError(raw as ApiErrorEnvelope);
  }
  return new ApiRequestError({
    error: {
      status: res.status,
      reason: "http_error",
      message: `HTTP ${res.status}`,
      details: { status_text: res.statusText },
    },
  });
}

/**
 * 最小 JSON 客户端（绑定 serverSocket + token）。
 */
export class HttpJsonClient {
  private readonly baseUrl: string;
  private readonly serverSocket: string;
  private accessToken: string;
  private readonly apiVersion: number;

  /**
   * 为指定 server 创建客户端实例。
   *
   * @param config - 客户端配置。
   */
  constructor(config: HttpJsonClientConfig) {
    this.serverSocket = String(config.serverSocket ?? "").trim();
    this.baseUrl = toApiBaseUrl(config.serverSocket);
    this.accessToken = String(config.accessToken ?? "").trim();
    this.apiVersion = Math.max(1, Math.trunc(config.apiVersion));
  }

  /**
   * 更新后续请求使用的 bearer token。
   *
   * @param token - 新 access token（空字符串表示清空）。
   */
  setAccessToken(token: string): void {
    this.accessToken = String(token ?? "").trim();
  }

  /**
   * 发起 JSON 请求并解析 JSON 响应。
   *
   * @param method - HTTP method。
   * @param path - 以 `/` 开头的 API path（例如 `/server`）。
   * @param body - 可选请求体（将被 JSON.stringify）。
   * @returns JSON 响应值。
   */
  async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    return this.requestJsonWithHeaders<T>(method, path, body, undefined);
  }

  /**
   * 发起 JSON 请求并解析 JSON 响应（支持附加 headers）。
   *
   * 用于全局不通用的 API 级行为，例如发送消息时的 `Idempotency-Key`。
   *
   * @param method - HTTP method。
   * @param path - 以 `/` 开头的 API path（例如 `/server`）。
   * @param body - 可选请求体（将被 JSON.stringify）。
   * @param extraHeaders - 可选附加 headers。
   * @returns JSON 响应值。
   */
  async requestJsonWithHeaders<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string> | undefined,
  ): Promise<T> {
    if (!this.baseUrl) throw new Error("缺少 server base URL");
    const normalizedPath = normalizeApiPath(path);
    const url = `${this.baseUrl}${normalizedPath}`;

    const headers: Record<string, string> = {
      Accept: buildCarryPigeonAcceptHeader(this.apiVersion),
    };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (body !== undefined) headers["Content-Type"] = "application/json; charset=utf-8";
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) headers[k] = v;
    }

    if (USE_MOCK_TRANSPORT) {
      const res = await handleProtocolMockApiRequest({
        serverSocket: this.serverSocket,
        method,
        path: normalizedPath,
        headers,
        body,
      });
      if (!res.ok) {
        const err = new ApiRequestError(res.error as ApiErrorEnvelope);
        logger.warn("Action: http_client_request_failed", { transport: "mock", method, url, status: err.status, reason: err.reason });
        throw err;
      }
      if (res.status === 204) return undefined as T;
      return res.body as T;
    }

    if (shouldUseTauriHttp(this.serverSocket, url)) {
      try {
        const tauriRes = await tauriRequestJson(this.serverSocket, method, normalizedPath, headers, body);
        if (!tauriRes.ok) {
          const err = new ApiRequestError(tauriRes.error as ApiErrorEnvelope);
          logger.warn("Action: http_client_request_failed", { transport: "tauri", method, url, status: err.status, reason: err.reason });
          throw err;
        }
        if (tauriRes.status === 204) return undefined as T;
        return tauriRes.body as T;
      } catch (e) {
        // 当 invoke 不可用（例如 Web 预览）或命令失败时，回退到 WebView fetch。
        // 对自签证书场景 fetch 仍可能失败，但可以保持行为一致性。
        logger.warn("Action: http_tauri_invoke_failed_fallback_to_fetch", { method, url, error: String(e) });
      }
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await toApiError(res);
      logger.warn("Action: http_client_request_failed", { transport: "fetch", method, url, status: err.status, reason: err.reason });
      throw err;
    }

    // 204 No Content：对很多端点来说属于合法成功响应。
    if (res.status === 204) return undefined as T;

    const json = await readJsonSafe(res);
    return json as T;
  }
}

/**
 * 将资源 path 归一化为 `/something` 形式。
 *
 * @param path - 原始 path。
 * @returns 以 `/` 开头的归一化 path。
 */
function normalizeApiPath(path: string): string {
  const p = String(path ?? "").trim();
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}
