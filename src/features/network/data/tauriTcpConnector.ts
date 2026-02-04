/**
 * @fileoverview TcpConnectorPort 的 Tauri 实现（data 层）。
 * @description 通过 `crateServerTcpService` 创建并握手 TCP 连接。
 */
import { crateServerTcpService } from "./TcpService";
import type { TcpConnectorPort } from "../domain/ports/TcpConnectorPort";
import { createLogger } from "@/shared/utils/logger";
import { ensureServerDb } from "@/shared/db";
import { toHttpOrigin } from "@/shared/net/http/serverOrigin";
import { rememberServerId } from "@/shared/serverIdentity";
import { serverRacks } from "@/features/servers/presentation/store/serverList";

const logger = createLogger("tauriTcpConnector");

type ApiServerVerifyResponse = {
  server_id?: string;
  api_version?: string;
  min_supported_api_version?: string;
};

type TlsPolicy = "strict" | "trust_fingerprint" | "insecure";
type TlsConfig = { tlsPolicy: TlsPolicy; tlsFingerprint: string };

/**
 * Determine whether the given socket string should be treated as an HTTP-origin
 * (HTTP+WS API) rather than a raw TCP/TLS socket.
 *
 * This keeps the UI usable when users paste:
 * - `https://host:port` (API origin)
 * - `wss://host/api/ws` (WS url)
 *
 * In those cases we do not attempt to create the legacy TCP service; we only
 * initialize the per-server DB namespace and let feature data adapters use
 * HTTP/WS as needed.
 *
 * @param serverSocket - Raw server socket string.
 * @returns `true` when the input is HTTP(S)/WS(S)-like.
 */
function isHttpLike(serverSocket: string): boolean {
  const s = serverSocket.trim().toLowerCase();
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("ws://") || s.startsWith("wss://");
}

/**
 * Determine whether a socket string explicitly declares a native transport scheme.
 *
 * @param serverSocket - Raw socket string.
 * @returns `true` when the string begins with a known native transport scheme.
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
 * Normalize a TLS fingerprint into compact hex form.
 *
 * @param raw - Raw fingerprint string.
 * @returns Lowercased hex with separators removed.
 */
function normalizeTlsFingerprint(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  return s.replace(/[^0-9a-f]/g, "");
}

/**
 * Resolve TLS policy/fingerprint for a given server socket key from the racks store.
 *
 * @param serverSocketKey - Server socket key.
 * @returns TLS config (defaults to strict with empty fingerprint).
 */
function resolveTlsConfig(serverSocketKey: string): TlsConfig {
  const key = serverSocketKey.trim();
  const rack = serverRacks.value.find((r) => r.serverSocket.trim() === key) ?? null;
  if (!rack) return { tlsPolicy: "strict", tlsFingerprint: "" };
  const tlsPolicy: TlsPolicy =
    rack.tlsPolicy === "strict" || rack.tlsPolicy === "trust_fingerprint" || rack.tlsPolicy === "insecure" ? rack.tlsPolicy : "strict";
  const tlsFingerprint = normalizeTlsFingerprint(rack.tlsFingerprint);
  return { tlsPolicy, tlsFingerprint };
}

/**
 * Build a native connect socket (tcp/tls) from a stable server socket key and a TLS policy.
 *
 * Notes:
 * - If the user provided an explicit scheme (e.g. `tcp://...`), we do not override it.
 * - `trust_fingerprint` is not implemented as a separate verifier yet; we currently fall back to strict TLS.
 *
 * @param serverSocketKey - Stable server socket key used as local namespace.
 * @param tlsPolicy - TLS policy preference (rack-level).
 * @param tlsFingerprint - Optional SHA-256 fingerprint (hex, no separators).
 * @returns Connect socket used by the native connector.
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
 * Parse a version string into a best-effort major number.
 *
 * @param raw - Version string like `"1.0"` or `"2"`.
 * @returns Major version number (defaults to 1 on invalid input).
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
      headers: { Accept: "application/vnd.carrypigeon+json; version=1" },
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`Handshake failed: GET /api/server HTTP ${res.status}`);
    const json = (await res.json()) as ApiServerVerifyResponse;
    const serverId = String(json?.server_id ?? "").trim();
    if (serverId) {
      rememberServerId(socket, serverId);
    } else {
      // PRD: core chat must remain usable without `server_id` (plugins disabled).
      logger.warn("Missing server_id in /api/server response; plugin features will be disabled", { socket });
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
   * Connect to the given server socket and ensure the required local resources exist.
   *
   * This adapter is the data-layer implementation of the `TcpConnectorPort`.
   * The current behavior for a "connect" includes:
   * - Ensuring the server-scoped local database is ready (for caches / local state).
   * - Creating the TCP service (which performs the handshake and starts frame listeners).
   *
   * @param serverSocket - Target server socket string (e.g. `tcp://host:port` or `mock://...`).
   * @returns Promise that resolves when the connection is established.
   */
  async connect(serverSocket: string): Promise<void> {
    const serverSocketKey = serverSocket.trim();
    if (!serverSocketKey) throw new Error("Missing server socket");
    logger.info("Connect server", { serverSocket: serverSocketKey });
    try {
      if (isHttpLike(serverSocketKey)) {
        await Promise.all([ensureServerDb(serverSocketKey), verifyHttpApi(serverSocketKey)]);
        logger.info("HTTP-like socket: skip legacy TCP handshake", { serverSocket: serverSocketKey });
        return;
      }

      const tls = resolveTlsConfig(serverSocketKey);
      const connectSocket = toNativeConnectSocket(serverSocketKey, tls.tlsPolicy, tls.tlsFingerprint);
      await Promise.all([ensureServerDb(serverSocketKey), crateServerTcpService(serverSocketKey, connectSocket)]);
      logger.info("Connect server success", { serverSocket: serverSocketKey, connectSocket, tlsPolicy: tls.tlsPolicy });
    } catch (e) {
      logger.error("Connect server failed", { serverSocket: serverSocketKey, error: String(e) });
      throw e;
    }
  },
};
