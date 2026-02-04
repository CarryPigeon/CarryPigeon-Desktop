/**
 * @fileoverview connectionStore.ts
 * @description Presentation store: handshake/connect state for ConnectionPill.
 */

import { computed, ref } from "vue";
import { getConnectToServerUsecase } from "@/features/network/di/network.di";
import { createLogger } from "@/shared/utils/logger";

export type ConnectionReason =
  | "ok"
  | "network_unreachable"
  | "handshake_failed"
  | "version_incompatible"
  | "tls_verify_failed"
  | "timeout"
  | "unknown";

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
 * Normalize an unknown thrown value into a readable message.
 *
 * @param e - Unknown error payload.
 * @returns Best-effort string.
 */
function toErrorString(e: unknown): string {
  if (e instanceof Error) return e.message || String(e);
  return String(e);
}

/**
 * Map an unknown connect error into a machine-readable ConnectionReason.
 *
 * @param e - Unknown error thrown by connector.
 * @returns ConnectionReason enum.
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
 * Build a user-facing detail string for the connection pill.
 *
 * @param reason - Mapped reason enum.
 * @param e - Unknown error payload.
 * @returns Detail string.
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
 * Internal mutable connection state used to derive view-model refs.
 */
const state = ref<ConnectionState>({
  phase: "idle",
  reason: "unknown",
  detail: "",
  lastServerSocket: "",
});

/**
 * Compute current connection phase for UI rendering.
 *
 * @returns Connection phase.
 */
function computeConnectionPhase(): ConnectionPhase {
  return state.value.phase;
}

/**
 * Current connection phase for UI rendering.
 *
 * @constant
 */
export const connectionPhase = computed(computeConnectionPhase);

/**
 * Compute machine-readable reason for the last failure (if any).
 *
 * @returns Connection reason.
 */
function computeConnectionReason(): ConnectionReason {
  return state.value.reason;
}

/**
 * Machine-readable reason for the last failure (if any).
 *
 * @constant
 */
export const connectionReason = computed(computeConnectionReason);

/**
 * Compute human-readable detail message for the ConnectionPill.
 *
 * @returns Detail message string.
 */
function computeConnectionDetail(): string {
  return state.value.detail;
}

/**
 * Human-readable detail message for the ConnectionPill tooltip or detail view.
 *
 * @constant
 */
export const connectionDetail = computed(computeConnectionDetail);

/**
 * Compute the UI-friendly state mapping for `ConnectionPill`.
 *
 * The pill component expects: `connected | reconnecting | offline`.
 *
 * @returns Pill state.
 */
function computeConnectionPillState(): "connected" | "reconnecting" | "offline" {
  if (state.value.phase === "connected") return "connected" as const;
  if (state.value.phase === "connecting") return "reconnecting" as const;
  if (state.value.phase === "failed") return "offline" as const;
  return "offline" as const;
}

/**
 * UI-friendly state mapping for `ConnectionPill`.
 *
 * @constant
 */
export const connectionPillState = computed(computeConnectionPillState);

/**
 * Connect with retry/backoff until success, or until superseded by a newer call.
 *
 * This is intended to support "disconnect can reconnect" UX even when the
 * underlying transport does not emit detailed disconnect signals.
 *
 * Notes:
 * - This function is "latest-wins": calling it again cancels the previous loop.
 * - It never throws; it updates `connectionPhase/connectionDetail` for UI.
 *
 * @param serverSocket - Target server socket.
 * @param options - Retry options.
 * @returns Promise that resolves when connected (or when canceled).
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
   * Compute the next reconnect delay using exponential backoff with jitter.
   *
   * @param attempt - Current attempt number (1-based).
   * @returns Delay in ms.
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
 * Attempt to connect to a server immediately (handshake).
 *
 * Behavior:
 * - Stores `serverSocket` as the last attempted socket (for retry).
 * - Updates connection phase for UI pill feedback.
 * - Uses the domain usecase `ConnectToServer` via DI, so presentation remains
 *   independent of the transport implementation (mock/tauri).
 *
 * @param serverSocket - Target server socket string.
 * @returns Promise<void>
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
    logger.error("Connect failed", { socket, error: String(e) });
    state.value = {
      phase: "failed",
      reason,
      detail: formatConnectDetail(reason, e),
      lastServerSocket: socket,
    };
  }
}

/**
 * Retry the last attempted connection.
 *
 * If no server socket was attempted yet, this will behave like a no-op connect
 * and move state to a failed "missing socket" case.
 *
 * @returns Promise<void>
 */
export function retryLast(): Promise<void> {
  return connectNow(state.value.lastServerSocket);
}
