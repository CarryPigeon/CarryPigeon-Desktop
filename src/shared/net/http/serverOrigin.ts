/**
 * @fileoverview serverSocket → HTTP origin 归一化工具。
 * @description 网络基础设施：serverOrigin。
 *
 * 背景：
 * - 历史上应用使用 `server_socket` 表示 TCP/TLS 连接地址。
 * - 引入 HTTP + WebSocket API（`/api/*`）后，仍允许用户输入多种形态的地址，
 *   但内部必须归一化为稳定的 HTTP origin（`http(s)://host:port`）。
 *
 * 设计目标：
 * - 把解析/归一化收敛到一个位置，避免各业务模块各自做字符串处理。
 * - UI 同时兼容 `host:port` 与完整 `https://host:port` 输入。
 * - 对 WS URL 做 best-effort 映射，并剥离 path/query/hash。
 */

/**
 * 将用户提供的 server socket 字符串归一化为 HTTP(S) origin。
 *
 * 支持输入（示例）：
 * - `https://127.0.0.1:8443`
 * - `http://localhost:8080`
 * - `127.0.0.1:8443` → `https://127.0.0.1:8443`
 * - `tls://127.0.0.1:9443` → `https://127.0.0.1:9443`（best-effort 映射）
 * - `wss://example.com/api/ws` → `https://example.com`（剥离 path）
 *
 * 说明：
 * - 这是面向自托管场景的“务实型”归一化器；若需要更严格的校验/提示，请在 UI 层（server editor）
 *   增加校验逻辑与错误反馈。
 *
 * @param serverSocket - 来自 UI/存储的原始 server socket 字符串。
 * @returns 不带尾部 `/` 的 HTTP origin（例如 `https://example.com:443`）。
 */
export function toHttpOrigin(serverSocket: string): string {
  const raw = serverSocket.trim();
  if (!raw) return "";

  // UI 预览环境使用的本地协议 mock scheme。
  if (raw.startsWith("mock://")) return "http://mock.local";

  // 若用户粘贴了 WS URL，则映射为等价的 HTTP origin。
  if (raw.startsWith("ws://")) return stripPath(`http://${raw.slice("ws://".length)}`);
  if (raw.startsWith("wss://")) return stripPath(`https://${raw.slice("wss://".length)}`);

  // 兼容旧 TCP/TLS 配置：把 legacy scheme 映射为 HTTP origin。
  if (raw.startsWith("tcp://")) return stripPath(`http://${raw.slice("tcp://".length)}`);
  if (raw.startsWith("tls://")) return stripPath(`https://${raw.slice("tls://".length)}`);
  if (raw.startsWith("tls-insecure://")) return stripPath(`https://${raw.slice("tls-insecure://".length)}`);
  if (raw.startsWith("tls-fp://")) {
    const rest = raw.slice("tls-fp://".length);
    const addr = rest.includes("@") ? rest.split("@").slice(1).join("@") : rest;
    return stripPath(`https://${addr}`);
  }
  if (raw.startsWith("socket://")) return stripPath(`https://${raw.slice("socket://".length)}`);

  // 已是 http(s) origin（可能带 path）：剥离 path。
  if (raw.startsWith("http://") || raw.startsWith("https://")) return stripPath(raw);

  // 仅 host[:port]：默认 https。
  return stripPath(`https://${raw}`);
}

/**
 * 将服务端返回的相对路径拼接为绝对 URL。
 *
 * API 约定：
 * - 服务端返回的文件/图片路径为相对字符串（不含域名）。
 * - 客户端拼接为 `https://{server_host}/{relative_path}`。
 *
 * @param serverSocket - 用于推导 origin 的 server socket。
 * @param relativePath - 相对路径（可不带前导 `/`）。
 * @returns 绝对 URL 字符串；当输入无效时返回空字符串。
 */
export function resolveServerUrl(serverSocket: string, relativePath: string): string {
  const origin = toHttpOrigin(serverSocket);
  const rel = String(relativePath ?? "").trim().replace(/^\/+/, "");
  if (!origin || !rel) return "";
  return `${origin}/${rel}`;
}

/**
 * 从类 URL 字符串中剥离 path/query/hash，并移除尾部 `/`。
 *
 * @param urlLike - URL 字符串（可能包含 path/query/hash）。
 * @returns 类 origin 字符串（best effort，例如 `https://example.com:8443`）。
 */
function stripPath(urlLike: string): string {
  const s = urlLike.trim();
  if (!s) return "";
  try {
    const u = new URL(s);
    return `${u.protocol}//${u.host}`;
  } catch {
    // 兜底：非 URL 输入时，粗暴去掉第一个 `/` 之后的内容，并去掉尾部 `/`。
    const head = s.split("/")[0] ? s.split("/").slice(0, 3).join("/") : s;
    return head.replace(/\/+$/, "");
  }
}
