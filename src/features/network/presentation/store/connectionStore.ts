/**
 * @fileoverview connectionStore.ts
 * @description network｜展示层状态（store）：connectionStore。
 */

import { computed, ref } from "vue";
import { getConnectToServerUsecase } from "@/features/network/di/network.di";
import { createLogger } from "@/shared/utils/logger";

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
let connectGeneration = 0;

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

  if (s.includes("timeout") || s.includes("timed out")) return "timeout";
  if (s.includes("tls") || s.includes("x509") || s.includes("certificate") || s.includes("cert_")) return "tls_verify_failed";
  if (s.includes("version") || s.includes("incompatible") || s.includes("unsupported api") || s.includes("min_supported")) return "version_incompatible";
  if (
    s.includes("unreachable") ||
    s.includes("network") ||
    s.includes("econnrefused") ||
    s.includes("enotfound") ||
    s.includes("ehostunreach") ||
    s.includes("econnreset")
  ) {
    return "network_unreachable";
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
  if (reason === "timeout") return raw ? `Timeout: ${raw}` : "Timeout";
  if (reason === "tls_verify_failed") return raw ? `TLS verify failed: ${raw}` : "TLS verify failed";
  if (reason === "version_incompatible") return raw ? `Version incompatible: ${raw}` : "Version incompatible";
  if (reason === "network_unreachable") return raw ? `Network unreachable: ${raw}` : "Network unreachable";
  if (reason === "handshake_failed") return raw ? `Handshake failed: ${raw}` : "Handshake failed";
  return raw || "Unknown error";
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
  const socket = serverSocket.trim();
  if (!socket) return;

  const gen = (connectGeneration += 1);
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
    if (gen !== connectGeneration) return;
    await connectNow(socket);
    if (gen !== connectGeneration) return;
    if (state.value.phase === "connected" && state.value.lastServerSocket === socket) return;

    if (attempt < maxAttempts) {
      const delayMs = computeDelay(attempt);
      state.value = { ...state.value, phase: "connecting", detail: `Reconnecting… (${attempt}/${maxAttempts})` };
      await new Promise<void>((resolve) => {
        window.setTimeout(() => resolve(), delayMs);
      });
    }
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
  const socket = serverSocket.trim();
  if (!socket) {
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
    state.value = { phase: "connected", reason: "ok", detail: "Connected", lastServerSocket: socket };
  } catch (e) {
    const reason = mapConnectErrorReason(e);
    logger.error("Action: connect_failed", { socket, error: String(e) });
    state.value = {
      phase: "failed",
      reason,
      detail: formatConnectDetail(reason, e),
      lastServerSocket: socket,
    };
  }
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
  return connectNow(state.value.lastServerSocket);
}
