/**
 * @fileoverview connectionStore.ts
 * @description server-connection/connectivity｜展示层状态（store）：connectionStore。
 */

import { computed, ref } from "vue";
import { getConnectToServerUsecase } from "@/features/server-connection/connectivity/di/network.di";
import { createLatestAsyncController } from "@/shared/utils/latestAsync";
import { createLogger } from "@/shared/utils/logger";
import { listenTcpState, type TcpStateEvent } from "@/shared/tauri";
import { startTcpRuntime } from "@/features/server-connection/connectivity/data/tcp";

/**
 * 连接失败原因枚举（用于 UI 展示与后续策略分支）。
 *
 * 说明：
 * - 该值由展示层对底层异常做归一化映射（`mapConnectErrorReason`）。
 * - 该枚举不承诺与服务端错误码一一对应，仅用于客户端内部分类与文案提示。
 */
export type ConnectionReason =
  | "ok"
  | "network_unreachable"
  | "handshake_failed"
  | "version_incompatible"
  | "tls_verify_failed"
  | "timeout"
  | "unknown";

/**
 * 连接阶段枚举（用于驱动 UI pill 状态与交互）。
 */
export type ConnectionPhase = "idle" | "connecting" | "connected" | "failed";

type ConnectionState = {
  phase: ConnectionPhase;
  reason: ConnectionReason;
  detail: string;
  lastServerSocket: string;
};

const logger = createLogger("connectionStore");
const connectCommandController = createLatestAsyncController();
let tcpStateListenerSubscribed = false;
let tcpStateListenerStartingPromise: Promise<void> | null = null;
let tcpStateUnlisten: (() => void) | null = null;
const latestTcpSessionBySocket = new Map<string, number>();

/**
 * 将未知异常值归一化为可读字符串。
 *
 * @param e - 未知错误载荷。
 * @returns 尽力而为的字符串描述。
 */
function toErrorString(e: unknown): string {
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}

type ConnectErrorRule = {
  reason: Exclude<ConnectionReason, "ok" | "unknown" | "handshake_failed">;
  patterns: string[];
};

const CONNECT_ERROR_RULES: ConnectErrorRule[] = [
  { reason: "timeout", patterns: ["timeout", "timed out"] },
  { reason: "tls_verify_failed", patterns: ["tls", "x509", "certificate", "cert_"] },
  { reason: "version_incompatible", patterns: ["version", "incompatible", "unsupported api", "min_supported"] },
  { reason: "network_unreachable", patterns: ["unreachable", "network", "econnrefused", "enotfound", "ehostunreach", "econnreset"] },
];

const CONNECTION_REASON_DETAIL_PREFIX: Record<ConnectionReason, string> = {
  ok: "Connected",
  timeout: "Timeout",
  tls_verify_failed: "TLS verify failed",
  version_incompatible: "Version incompatible",
  network_unreachable: "Network unreachable",
  handshake_failed: "Handshake failed",
  unknown: "Unknown error",
};

/**
 * 将“连接/握手”阶段的未知错误映射为机器可读的 `ConnectionReason`。
 *
 * @param e - 连接器抛出的未知错误。
 * @returns `ConnectionReason` 枚举值。
 */
function mapConnectErrorReason(e: unknown): ConnectionReason {
  const raw = toErrorString(e).trim();
  const s = raw.toLowerCase();
  if (!s) return "unknown";
  for (const rule of CONNECT_ERROR_RULES) {
    if (rule.patterns.some((pattern) => s.includes(pattern))) {
      return rule.reason;
    }
  }
  return "handshake_failed";
}

/**
 * 构造用于 `ConnectionPill` 展示的详情文案。
 *
 * @param reason - 已映射的失败原因。
 * @param e - 原始错误载荷。
 * @returns 详情字符串。
 */
function formatConnectDetail(reason: ConnectionReason, e: unknown): string {
  const raw = toErrorString(e).trim();
  const prefix = CONNECTION_REASON_DETAIL_PREFIX[reason] ?? CONNECTION_REASON_DETAIL_PREFIX.unknown;
  if (!raw) return prefix;
  if (reason === "unknown") return raw;
  return `${prefix}: ${raw}`;
}

/**
 * 内部可变连接状态：作为视图模型（computed refs）的单一数据源。
 */
const state = ref<ConnectionState>({
  phase: "idle",
  reason: "unknown",
  detail: "",
  lastServerSocket: "",
});

/**
 * 将 Rust 侧 TCP 生命周期事件映射到前端连接状态。
 *
 * @param event - TCP 生命周期事件。
 * @returns 无返回值。
 */
function applyTcpStateEvent(event: TcpStateEvent): void {
  const socket = String(event.server_socket ?? "").trim();
  if (!socket) return;

  const sessionId = Number(event.session_id ?? 0);
  const normalizedSessionId = Number.isFinite(sessionId) && sessionId > 0 ? Math.trunc(sessionId) : 0;
  const knownSessionId = latestTcpSessionBySocket.get(socket) ?? 0;
  if (normalizedSessionId > 0 && normalizedSessionId < knownSessionId) {
    // Ignore stale events from an older TCP session generation.
    return;
  }
  if (normalizedSessionId > knownSessionId) {
    latestTcpSessionBySocket.set(socket, normalizedSessionId);
  }

  if (state.value.lastServerSocket.trim() !== socket) return;

  if (event.state === "connected") {
    state.value = { ...state.value, phase: "connected", reason: "ok", detail: "Connected" };
    return;
  }

  if (event.state === "disconnected") {
    state.value = {
      ...state.value,
      phase: "failed",
      reason: "network_unreachable",
      detail: "Disconnected",
    };
    return;
  }

  if (event.state === "error") {
    const raw = String(event.error ?? "").trim() || "TCP read failed";
    const reason = mapConnectErrorReason(raw);
    state.value = {
      ...state.value,
      phase: "failed",
      reason,
      detail: formatConnectDetail(reason, raw),
    };
  }
}

/**
 * 启用 TCP 生命周期事件订阅（模块级一次性）。
 *
 * @returns 无返回值。
 */
async function ensureTcpStateListener(): Promise<void> {
  if (tcpStateListenerSubscribed) return;
  if (tcpStateListenerStartingPromise) {
    await tcpStateListenerStartingPromise;
    return;
  }
  tcpStateListenerStartingPromise = (async () => {
    try {
      tcpStateUnlisten = await listenTcpState((event) => {
        applyTcpStateEvent(event.payload);
      });
      tcpStateListenerSubscribed = true;
    } catch (e) {
      tcpStateListenerSubscribed = false;
      logger.warn("Action: network_tcp_state_listener_subscribe_failed", { error: String(e) });
      throw e;
    } finally {
      tcpStateListenerStartingPromise = null;
    }
  })();
  await tcpStateListenerStartingPromise;
}

function setRuntimeUnavailableState(error: unknown): void {
  logger.error("Action: network_tcp_state_listener_start_failed", { error: String(error) });
  state.value = {
    phase: "failed",
    reason: "network_unreachable",
    detail: "Connection runtime unavailable",
    lastServerSocket: "",
  };
}

async function ensureRuntimeReadyOrSetFailedState(): Promise<boolean> {
  try {
    await startTcpRuntime();
    await ensureTcpStateListener();
    return true;
  } catch (error) {
    setRuntimeUnavailableState(error);
    return false;
  }
}

/**
 * 启动连接状态运行时（幂等）。
 *
 * 说明：
 * - 显式启动，避免模块加载时产生订阅副作用。
 */
export async function startConnectionRuntime(): Promise<void> {
  await ensureTcpStateListener();
}

/**
 * 停止连接状态运行时（best-effort）。
 */
export function stopConnectionRuntime(): void {
  if (tcpStateUnlisten) {
    tcpStateUnlisten();
    tcpStateUnlisten = null;
  }
  tcpStateListenerSubscribed = false;
  tcpStateListenerStartingPromise = null;
  latestTcpSessionBySocket.clear();
}

/**
 * 计算当前连接阶段（供 UI 渲染）。
 *
 * @returns 连接阶段。
 */
function computeConnectionPhase(): ConnectionPhase {
  return state.value.phase;
}

/**
 * 当前连接阶段（供 UI 渲染）。
 *
 * @constant
 */
export const connectionPhase = computed(computeConnectionPhase);

/**
 * 计算最近一次失败的机器可读原因（若存在）。
 *
 * @returns 连接失败原因。
 */
function computeConnectionReason(): ConnectionReason {
  return state.value.reason;
}

/**
 * 最近一次失败的机器可读原因（若存在）。
 *
 * @constant
 */
export const connectionReason = computed(computeConnectionReason);

/**
 * 计算 `ConnectionPill` 用于展示的详情文案。
 *
 * @returns 详情文案字符串。
 */
function computeConnectionDetail(): string {
  return state.value.detail;
}

/**
 * `ConnectionPill` tooltip/详情区域的可读文案。
 *
 * @constant
 */
export const connectionDetail = computed(computeConnectionDetail);

/**
 * 计算 `ConnectionPill` 的 UI 友好状态映射。
 *
 * 说明：
 * pill 组件仅接受：`connected | reconnecting | offline`。
 *
 * @returns pill 状态。
 */
function computeConnectionPillState(): "connected" | "reconnecting" | "offline" {
  if (state.value.phase === "connected") return "connected" as const;
  if (state.value.phase === "connecting") return "reconnecting" as const;
  if (state.value.phase === "failed") return "offline" as const;
  return "offline" as const;
}

/**
 * `ConnectionPill` 的 UI 友好状态映射。
 *
 * @constant
 */
export const connectionPillState = computed(computeConnectionPillState);

/**
 * 连接并按重试/退避策略循环尝试：直到成功，或被更新的一次调用“覆盖取消”。
 *
 * 目的：
 * 即便底层传输层不提供详细断连事件，也能提供“断开可自动重连”的 UX。
 *
 * 约定：
 * - “latest-wins”：再次调用会取消之前的循环；
 * - 本函数不抛异常；通过更新 `connectionPhase/connectionDetail` 驱动 UI。
 *
 * @param serverSocket - 目标服务端 socket。
 * @param options - 重试配置。
 * @returns 连接成功或被取消时 resolve。
 */
export async function connectWithRetry(
  serverSocket: string,
  options?: { maxAttempts?: number; maxDelayMs?: number; baseDelayMs?: number },
): Promise<void> {
  if (!(await ensureRuntimeReadyOrSetFailedState())) return;
  const socket = serverSocket.trim();
  if (!socket) return;

  const token = connectCommandController.begin();
  const maxAttempts = Math.max(1, Math.trunc(options?.maxAttempts ?? 20));
  const baseDelayMs = Math.max(200, Math.trunc(options?.baseDelayMs ?? 900));
  const maxDelayMs = Math.max(baseDelayMs, Math.trunc(options?.maxDelayMs ?? 30_000));

  /**
   * 计算下一次重连延迟：指数退避 + 少量随机抖动（jitter）。
   *
   * @param attempt - 当前尝试次数（从 1 开始）。
   * @returns 延迟毫秒数。
   */
  function computeDelay(attempt: number): number {
    const n = Math.max(1, Math.trunc(attempt));
    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(6, n - 1));
    const jitter = Math.trunc(Math.random() * 250);
    return delay + jitter;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (!connectCommandController.isCurrent(token)) return;
    await connectNowInternal(socket, token);
    if (!connectCommandController.isCurrent(token)) return;
    if (state.value.phase === "connected" && state.value.lastServerSocket === socket) return;

    if (attempt < maxAttempts) {
      const delayMs = computeDelay(attempt);
      state.value = { ...state.value, phase: "connecting", detail: `Reconnecting… (${attempt}/${maxAttempts})` };
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), delayMs);
      });
      if (!connectCommandController.isCurrent(token)) return;
    }
  }
}

async function connectNowInternal(serverSocket: string, token: number): Promise<void> {
  if (!(await ensureRuntimeReadyOrSetFailedState())) return;
  const socket = serverSocket.trim();
  if (!socket) {
    if (!connectCommandController.isCurrent(token)) return;
    state.value = {
      phase: "failed",
      reason: "network_unreachable",
      detail: "Missing server socket",
      lastServerSocket: "",
    };
    return;
  }

  state.value = { phase: "connecting", reason: "unknown", detail: "Handshake…", lastServerSocket: socket };
  try {
    await getConnectToServerUsecase().execute(socket);
    if (!connectCommandController.isCurrent(token)) return;
    state.value = { phase: "connected", reason: "ok", detail: "Connected", lastServerSocket: socket };
  } catch (e) {
    if (!connectCommandController.isCurrent(token)) return;
    const reason = mapConnectErrorReason(e);
    logger.error("Action: network_connect_server_failed", { socket, error: String(e) });
    state.value = {
      phase: "failed",
      reason,
      detail: formatConnectDetail(reason, e),
      lastServerSocket: socket,
    };
  }
}

/**
 * 立即尝试连接服务端（执行一次握手）。
 *
 * 行为：
 * - 记录 `lastServerSocket`，用于“重试上一次连接”；
 * - 更新连接阶段，驱动 UI pill 的反馈；
 * - 通过 DI 调用领域用例 `ConnectToServer`，使展示层不依赖传输实现（mock/tauri）。
 *
 * @param serverSocket - 目标服务端 socket 字符串。
 * @returns 无返回值。
 */
export async function connectNow(serverSocket: string): Promise<void> {
  const token = connectCommandController.begin();
  await connectNowInternal(serverSocket, token);
}

/**
 * 重试上一次尝试的连接。
 *
 * 若此前从未尝试过连接（lastServerSocket 为空）：
 * - 行为等同于一次“空 socket 的 connectNow”，并进入失败态（Missing socket）。
 *
 * @returns 无返回值。
 */
export function retryLast(): Promise<void> {
  const token = connectCommandController.begin();
  return connectNowInternal(state.value.lastServerSocket, token);
}
