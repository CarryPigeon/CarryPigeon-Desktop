/**
 * @fileoverview chat/serverWorkspace integration
 * @description
 * 为 chat feature 提供统一的服务器工作区访问入口，避免各子模块直接依赖 server-connection feature。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import { getServerConnectionCapabilities } from "@/features/server-connection/api";
import type {
  ServerWorkspaceActivationOutcome,
  ServerWorkspaceConnectionOutcome,
  ServerWorkspaceInfoRefreshOutcome,
  ServerWorkspaceSwitchOptions,
} from "@/features/server-connection/api-types";
import { createCapabilitySnapshotRef } from "@/shared/utils/createCapabilitySnapshotRef";

const serverConnectionCapabilities = getServerConnectionCapabilities();
type ServerConnectionCapabilities = ReturnType<typeof getServerConnectionCapabilities>;
type ServerWorkspaceSnapshot = ReturnType<ServerConnectionCapabilities["workspace"]["getSnapshot"]>;
type ServerInfo = ReturnType<ServerConnectionCapabilities["workspace"]["readInfo"]>;

type ServerInfoStoreView = {
  info: ComputedRef<ServerInfo | null>;
  loading: ComputedRef<boolean>;
  error: ComputedRef<string>;
  refresh(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

type ChatServerWorkspace = {
  socket: ComputedRef<string>;
  serverInfoStore: ComputedRef<ServerInfoStoreView>;
  serverId: ComputedRef<string>;
  refreshServerInfo(): Promise<ServerWorkspaceInfoRefreshOutcome>;
};

const chatServerWorkspaceState: Ref<ServerWorkspaceSnapshot> = createCapabilitySnapshotRef(
  serverConnectionCapabilities.workspace,
);

function getChatServerWorkspaceState(): Ref<ServerWorkspaceSnapshot> {
  return chatServerWorkspaceState;
}

/**
 * 当前 chat workspace 绑定的 server socket。
 */
export const chatCurrentServerSocket = computed(() => getChatServerWorkspaceState().value.serverSocket);
/**
 * 当前 server 目录投影。
 */
export const chatServerRacks = computed(() => getChatServerWorkspaceState().value.serverDirectory);
/**
 * 当前连接详情投影。
 */
export const chatConnectionDetail = computed(() => getChatServerWorkspaceState().value.connectionDetail);
/**
 * 当前连接 pill 状态投影。
 */
export const chatConnectionPillState = computed(() => getChatServerWorkspaceState().value.connectionPillState);
/**
 * 当前连接阶段投影。
 */
export const chatConnectionPhase = computed(() => getChatServerWorkspaceState().value.connectionPhase);
/**
 * 对当前选中 server 执行重连。
 */
export const retryChatConnection = (): Promise<ServerWorkspaceConnectionOutcome> =>
  serverConnectionCapabilities.workspace.retryConnect();

const chatServerInfo = computed(() => getChatServerWorkspaceState().value.serverInfo);
const chatServerInfoLoading = computed(() => getChatServerWorkspaceState().value.serverInfoLoading);
const chatServerInfoError = computed(() => getChatServerWorkspaceState().value.serverInfoError);
const chatServerId = computed(() => getChatServerWorkspaceState().value.serverId);
const chatServerInfoStore = computed<ServerInfoStoreView>(() => ({
  info: chatServerInfo,
  loading: chatServerInfoLoading,
  error: chatServerInfoError,
  refresh: () => serverConnectionCapabilities.workspace.refreshInfo(),
}));

/**
 * 获取 chat 当前绑定的 server workspace 视图。
 */
export function useChatServerWorkspace(): ChatServerWorkspace {
  return {
    socket: chatCurrentServerSocket,
    serverInfoStore: chatServerInfoStore,
    serverId: chatServerId,
    refreshServerInfo: () => serverConnectionCapabilities.workspace.refreshInfo(),
  };
}

/**
 * 读取当前 chat workspace 绑定的 server socket。
 */
export function getActiveChatServerSocket(): string {
  return serverConnectionCapabilities.workspace.readSocket();
}

/**
 * 仅切换当前选中 server，不主动发起连接。
 */
export function selectActiveChatServer(serverSocket: string): void {
  serverConnectionCapabilities.workspace.selectSocket(serverSocket);
}

/**
 * 激活某个 server 并立即尝试建立连接。
 */
export function connectChatServer(serverSocket: string): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, {
    connect: true,
    refreshInfo: false,
  });
}

/**
 * 切换 chat workspace 到某个 server。
 *
 * 这是 chat feature 切服的主入口，是否立即连接、是否刷新信息由 `options` 决定。
 */
export function switchChatServerWorkspace(
  serverSocket: string,
  options?: ServerWorkspaceSwitchOptions,
): Promise<ServerWorkspaceActivationOutcome> {
  return serverConnectionCapabilities.workspace.activate(serverSocket, options);
}

/**
 * 读取某个 server 的 TLS 策略。
 */
export function getChatTlsPolicy(serverSocket: string) {
  return serverConnectionCapabilities.workspace.readTlsPolicy(serverSocket);
}

/**
 * 判断服务端是否声明提供 realtime 能力（WS）。
 *
 * 判定依据（满足任一即视为有 realtime）：
 * - `ws_url` 非空字符串；
 * - 或 `capabilities.eventResume === true`（服务端 `ServerCapabilities.eventResume` 即 realtime.enabled）。
 *
 * 当服务端默认 `realtime.enabled=false` 时，`ws_url` 为 `null` 且 `eventResume=false`，
 * 此时客户端不应再尝试 `ws://<http-port>/api/ws`（HTTP 端口不开 WS），而应直接走 long-polling。
 *
 * @param serverSocket - 目标 server socket。
 * @returns 当服务端声明有 realtime 时返回 `true`。
 */
export function isChatRealtimeAvailable(serverSocket: string): boolean {
  const info =
    serverSocket === serverConnectionCapabilities.workspace.readSocket()
      ? serverConnectionCapabilities.workspace.readInfo()
      : null;
  const wsUrl = String(info?.wsUrl ?? "").trim();
  if (wsUrl) return true;
  const capabilities = info?.capabilities;
  if (capabilities && typeof capabilities === "object") {
    const eventResume = (capabilities as Record<string, unknown>).event_resume;
    if (eventResume === true) return true;
  }
  return false;
}

/**
 * 读取当前 server 提供的 WS URL 覆盖值。
 *
 * 只有在该 server 已经是当前激活 server 时，才会返回可用信息。
 *
 * 兜底重写（C3a）：服务端 `RealtimeDiscoverySettings.wsUrl()` 写死 `wss://` 且默认 host 为
 * `127.0.0.1`/`localhost`，对外网/局域网客户端不可达。当返回的 `ws_url` 主机是 loopback
 * 而登录地址的主机不同时，这里用“登录主机 + ws_url 端口 + ws_url path”重写 override，
 * scheme 按“登录 origin 是否 https”决定 `ws://`/`wss://`，避免在明文链路上强行 `wss://` 失败。
 */
export function getChatWsUrlOverride(serverSocket: string): string | undefined {
  const info =
    serverSocket === serverConnectionCapabilities.workspace.readSocket()
      ? serverConnectionCapabilities.workspace.readInfo()
      : null;
  const rawWsUrl = String(info?.wsUrl ?? "").trim();
  if (!rawWsUrl) return undefined;

  // 解析 ws_url 的 host/port/path；解析失败则原样返回，交给后续连接失败回退处理。
  let parsed: URL;
  try {
    parsed = new URL(rawWsUrl);
  } catch {
    return rawWsUrl;
  }
  const wsHost = parsed.hostname.toLowerCase();
  const isLoopback = wsHost === "127.0.0.1" || wsHost === "localhost" || wsHost === "::1";

  // 推导登录主机：serverSocket 形态可能是 `http(s)://host:port`、`host:port`、`ws(s)://...` 等。
  const loginHost = deriveLoginHost(serverSocket);
  if (!isLoopback || !loginHost || loginHost.toLowerCase() === wsHost) {
    // 非 loopback，或无法判定登录主机 → 保持服务端原值；连接失败由 polling 回退兜底。
    return rawWsUrl;
  }

  // 登录 origin 是 https 才用 wss，否则明文用 ws（避免服务端写死 wss:// 在明文链路上的失败）。
  const scheme = isLikelyHttpsOrigin(serverSocket) ? "wss" : "ws";
  const port = parsed.port ? `:${parsed.port}` : "";
  const path = parsed.pathname || "/api/ws";
  const rewritten = `${scheme}://${loginHost}${port}${path}`;
  return rewritten;
}

/**
 * 从 server socket 字符串中尽力推导出登录主机（hostname）。
 *
 * @param serverSocket - 原始 server socket 字符串。
 * @returns 主机名（小写）；推导失败返回空字符串。
 */
function deriveLoginHost(serverSocket: string): string {
  const raw = String(serverSocket ?? "").trim();
  if (!raw) return "";
  // 带 scheme 的输入直接用 URL 解析。
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    try {
      return new URL(raw).hostname.toLowerCase();
    } catch {
      return "";
    }
  }
  // 纯 `host:port` 或 `host`：取第一个 `:` 之前的部分。
  const head = raw.split("/")[0] ?? raw;
  const colonIdx = head.indexOf(":");
  const host = colonIdx > 0 ? head.slice(0, colonIdx) : head;
  return host.toLowerCase();
}

/**
 * 判断 server socket 对应的登录 origin 是否应当被视为 HTTPS。
 *
 * 用于在重写 ws_url 时决定 scheme（`ws://` vs `wss://`）。
 *
 * @param serverSocket - 原始 server socket 字符串。
 * @returns 当显式声明 `https://`/`wss://`/`tls://` 时返回 `true`；明文形态返回 `false`。
 */
function isLikelyHttpsOrigin(serverSocket: string): boolean {
  const s = String(serverSocket ?? "").trim().toLowerCase();
  return s.startsWith("https://") || s.startsWith("wss://") || s.startsWith("tls://") || s.startsWith("tls-fp://");
}
