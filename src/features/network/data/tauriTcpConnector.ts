/**
 * @fileoverview TcpConnectorPort 的 Tauri 实现（data 层）。
 * @description 通过 `createServerTcpService` 创建并握手 TCP 连接。
 */
import { createServerTcpService } from "./TcpService";
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";
import { ensureServerDb } from "@/shared/db";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { rememberServerId } from "@/shared/serverIdentity";
import { CARRY_PIGEON_ACCEPT_V1 } from "@/shared/net/http/apiHeaders";
import { getServerTlsConfig } from "@/shared/net/tls/serverTlsConfigProvider";
import type { TlsPolicy } from "@/shared/net/tls/tlsTypes";

const logger = createLogger("tauriTcpConnector");

type ApiServerVerifyResponse = {
  server_id?: string;
  api_version?: string;
  min_supported_api_version?: string;
};

type TlsConfig = { tlsPolicy: TlsPolicy; tlsFingerprint: string };

/**
 * 判断输入的 socket 字符串是否应当按“HTTP Origin（HTTP+WS API）”处理，而不是原始 TCP/TLS socket。
 *
 * 背景：
 * - 用户可能直接粘贴 `https://host:port`（API origin）或 `wss://host/api/ws`（WS URL）；
 * - 为了保持 UI 可用性，这类输入不应走旧版 TCP 握手，而应走 HTTP/WS 数据通道；
 * - 在这种情况下，我们只初始化“按 server 隔离”的本地 DB 命名空间，后续由各 feature data adapter 自行按需使用 HTTP/WS。
 *
 * @param serverSocket - 原始 server socket 字符串。
 * @returns 当输入为 HTTP(S)/WS(S) 形态时返回 `true`。
 */
function isHttpLike(serverSocket: string): boolean {
  const s = serverSocket.trim().toLowerCase();
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("ws://") || s.startsWith("wss://");
}

/**
 * 判断 socket 字符串是否显式声明了 native transport scheme（mock/tcp/tls 等）。
 *
 * @param serverSocket - 原始 socket 字符串。
 * @returns 当字符串以已知的 native transport scheme 开头时返回 `true`。
 */
function isExplicitNativeTransport(serverSocket: string): boolean {
  const s = serverSocket.trim().toLowerCase();
  return (
    s.startsWith("mock://") ||
    s.startsWith("tcp://") ||
    s.startsWith("tls://") ||
    s.startsWith("tls-insecure://") ||
    s.startsWith("tls-fp://")
  );
}

/**
 * 将 TLS 指纹归一化为紧凑的 hex 字符串（去分隔符、转小写）。
 *
 * @param raw - 原始指纹字符串。
 * @returns 归一化后的 hex（小写、无分隔符）。
 */
function normalizeTlsFingerprint(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/[^0-9a-f]/g, "");
}

/**
 * 从 racks store 中解析某个 server socket 的 TLS 策略与指纹配置。
 *
 * @param serverSocketKey - 服务器 Socket 地址（作为 rack key）。
 * @returns TLS 配置（默认 strict + 空指纹）。
 */
function resolveTlsConfig(serverSocketKey: string): TlsConfig {
  const tls = getServerTlsConfig(serverSocketKey);
  return { tlsPolicy: tls.tlsPolicy, tlsFingerprint: normalizeTlsFingerprint(tls.tlsFingerprint) };
}

/**
 * 基于稳定的 server socket key 与 TLS 策略构建 native 连接地址（tcp/tls）。
 *
 * 说明：
 * - 若用户显式提供 scheme（例如 `tcp://...`），则不覆盖。
 * - `trust_fingerprint` 目前通过特殊 scheme 表达（`tls-fp://`）；若未来引入独立 verifier，可在此处扩展。
 *
 * @param serverSocketKey - 稳定的 server socket key（同时作为本地命名空间）。
 * @param tlsPolicy - TLS 策略（rack 级）。
 * @param tlsFingerprint - TLS 指纹（可选，SHA-256 hex，无分隔符）。
 * @returns native connector 使用的连接地址。
 */
function toNativeConnectSocket(serverSocketKey: string, tlsPolicy: TlsPolicy, tlsFingerprint: string): string {
  const raw = serverSocketKey.trim();
  if (!raw) return "";
  if (isHttpLike(raw)) return raw;
  if (isExplicitNativeTransport(raw)) return raw;

  if (tlsPolicy === "trust_fingerprint") {
    const fp = normalizeTlsFingerprint(tlsFingerprint);
    if (fp.length !== 64) throw new Error("TLS fingerprint missing/invalid: must be SHA-256 (64 hex chars)");
    const prefix = raw.toLowerCase().startsWith("socket://") ? raw.slice("socket://".length) : raw;
    return `tls-fp://${fp}@${prefix}`;
  }

  const scheme = tlsPolicy === "insecure" ? "tls-insecure://" : "tls://";
  if (raw.toLowerCase().startsWith("socket://")) return `${scheme}${raw.slice("socket://".length)}`;
  return `${scheme}${raw}`;
}

/**
 * 将版本字符串解析为 best-effort 的主版本号（major）。
 *
 * @param raw - 版本字符串（例如 `"1.0"` / `"2"`）。
 * @returns 主版本号（解析失败时默认返回 1）。
 */
function parseMajorVersion(raw: string): number {
  const s = String(raw ?? "").trim();
  if (!s) return 1;
  const head = s.split(".")[0] ?? "";
  const n = Number(head);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.trunc(n));
}

/**
 * Verify the HTTP API endpoint is reachable by calling `GET /api/server`.
 *
 * This makes the "Handshake → Verify → Auth" stages align with `docs/api/*`:
 * - If the host is unreachable, connect should fail early with a meaningful error.
 * - If the API version is incompatible, connect should fail with a version hint.
 * - If `server_id` is missing, we treat it as an invalid server response.
 *
 * @param serverSocket - Raw server socket string.
 * @returns Promise<void>
 */
async function verifyHttpApi(serverSocket: string): Promise<void> {
  const socket = serverSocket.trim();
  const origin = toHttpOrigin(socket);
  if (!origin) throw new Error("Invalid server origin");

  const url = `${origin}/api/server`;
  const ac = new AbortController();
  const timeoutMs = 6500;
  const timer = globalThis.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: CARRY_PIGEON_ACCEPT_V1 },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Handshake failed: GET /api/server HTTP ${res.status}`);
    const json = (await res.json()) as ApiServerVerifyResponse;
    const serverId = String(json?.server_id ?? "").trim();
    if (serverId) {
      rememberServerId(socket, serverId);
    } else {
      // PRD：核心聊天必须在缺失 `server_id` 时仍可用（插件功能禁用）。
      logger.warn("Action: network_server_id_missing_plugins_disabled", { socket });
    }

    const minSupported = String(json?.min_supported_api_version ?? "").trim();
    if (minSupported) {
      const major = parseMajorVersion(minSupported);
      if (major > 1) throw new Error(`Unsupported API version: min_supported_api_version=${minSupported}`);
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Handshake timeout: GET /api/server exceeded ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

/**
 * @constant
 * @description 基于 Tauri 的 TCP 连接器适配器（实现 domain port）。
 */
export const tauriTcpConnector: TcpConnectorPort = {
  /**
   * 连接到指定服务器，并确保所需的本地资源已就绪。
   *
   * 说明：该适配器是 `TcpConnectorPort` 的 data-layer 实现。
   *
   * 当前 `connect` 的行为包含：
   * - 确保 server scope 的本地数据库已准备完成（用于缓存/本地状态等）。
   * - 创建 TCP service（内部执行握手并启动帧监听）。
   *
   * @param serverSocket - 服务器 Socket 地址（例如 `tcp://host:port` 或 `mock://...`）。
   * @returns 无返回值。
   */
  async connect(serverSocket: string): Promise<void> {
    const serverSocketKey = serverSocket.trim();
    if (!serverSocketKey) throw new Error("Missing server socket");
    logger.info("Action: network_connect_server_started", { serverSocket: serverSocketKey });
    try {
      if (isHttpLike(serverSocketKey)) {
        await Promise.all([ensureServerDb(serverSocketKey), verifyHttpApi(serverSocketKey)]);
        logger.info("Action: network_http_like_socket_tcp_handshake_skipped", { serverSocket: serverSocketKey });
        return;
      }

      const tls = resolveTlsConfig(serverSocketKey);
      const connectSocket = toNativeConnectSocket(serverSocketKey, tls.tlsPolicy, tls.tlsFingerprint);
      await Promise.all([ensureServerDb(serverSocketKey), createServerTcpService(serverSocketKey, connectSocket)]);
      logger.info("Action: network_connect_server_succeeded", { serverSocket: serverSocketKey, connectSocket, tlsPolicy: tls.tlsPolicy });
    } catch (e) {
      logger.error("Action: network_connect_server_failed", { serverSocket: serverSocketKey, error: String(e) });
      throw e;
    }
  },
};
