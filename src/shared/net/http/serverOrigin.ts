/**
 * @fileoverview Server origin helpers for HTTP/WS and asset URL building.
 * @description
 * The app historically used `server_socket` values for TCP/TLS connections.
 * With the HTTP + WebSocket API (`/api`), we still accept a flexible input
 * string from users, but we must normalize it into a stable HTTP origin.
 *
 * Design goals:
 * - Keep parsing/normalization in one place.
 * - Make UI code work with both "host:port" and full "https://host:port".
 * - Avoid sprinkling string hacks across features.
 */

/**
 * Normalize a user-provided server socket string into an HTTP(S) origin.
 *
 * Supported inputs (examples):
 * - `https://127.0.0.1:8443`
 * - `http://localhost:8080`
 * - `127.0.0.1:8443` → `https://127.0.0.1:8443`
 * - `tls://127.0.0.1:9443` → `https://127.0.0.1:9443` (best-effort mapping)
 * - `wss://example.com/api/ws` → `https://example.com` (path removed)
 *
 * Notes:
 * - This is a pragmatic normalizer for a self-hosted product. If you need
 *   strict parsing/validation, add it at the UI layer (server editor).
 *
 * @param serverSocket - Raw server socket string from UI/storage.
 * @returns HTTP origin without trailing slash (e.g. `https://example.com:443`).
 */
export function toHttpOrigin(serverSocket: string): string {
  const raw = serverSocket.trim();
  if (!raw) return "";

  // Local protocol-mock scheme used by the UI preview environment.
  if (raw.startsWith("mock://")) return "http://mock.local";

  // If user pasted the WS URL, convert it to the equivalent HTTP origin.
  if (raw.startsWith("ws://")) return stripPath(`http://${raw.slice("ws://".length)}`);
  if (raw.startsWith("wss://")) return stripPath(`https://${raw.slice("wss://".length)}`);

  // Common scheme mappings from legacy TCP configs into an HTTP origin.
  if (raw.startsWith("tcp://")) return stripPath(`http://${raw.slice("tcp://".length)}`);
  if (raw.startsWith("tls://")) return stripPath(`https://${raw.slice("tls://".length)}`);
  if (raw.startsWith("tls-insecure://")) return stripPath(`https://${raw.slice("tls-insecure://".length)}`);
  if (raw.startsWith("tls-fp://")) {
    const rest = raw.slice("tls-fp://".length);
    const addr = rest.includes("@") ? rest.split("@").slice(1).join("@") : rest;
    return stripPath(`https://${addr}`);
  }
  if (raw.startsWith("socket://")) return stripPath(`https://${raw.slice("socket://".length)}`);

  // Already an http(s) origin (possibly with path): strip the path.
  if (raw.startsWith("http://") || raw.startsWith("https://")) return stripPath(raw);

  // Host[:port] only: default to https.
  return stripPath(`https://${raw}`);
}

/**
 * Build an absolute URL for a server-relative path.
 *
 * API rule:
 * - The server returns file/image paths as relative strings (no domain).
 * - The client builds `https://{server_host}/{relative_path}`.
 *
 * @param serverSocket - Raw server socket string used to derive origin.
 * @param relativePath - Relative path (no leading slash required).
 * @returns Absolute URL string, or empty string when inputs are invalid.
 */
export function resolveServerUrl(serverSocket: string, relativePath: string): string {
  const origin = toHttpOrigin(serverSocket);
  const rel = String(relativePath ?? "").trim().replace(/^\/+/, "");
  if (!origin || !rel) return "";
  return `${origin}/${rel}`;
}

/**
 * Strip any path/query/hash from a URL-like string and remove trailing slashes.
 *
 * @param urlLike - URL string (may include path/query/hash).
 * @returns Origin-like string, best effort (e.g. `https://example.com:8443`).
 */
function stripPath(urlLike: string): string {
  const s = urlLike.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    // Fallback for non-URL inputs: remove after first "/" and trim trailing "/".
    const head = s.split("/")[0] ? s.split("/").slice(0, 3).join("/") : s;
    return head.replace(/\/+$/, "");
  }
}
