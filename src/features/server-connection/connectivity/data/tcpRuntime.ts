/**
 * @fileoverview TCP runtime 组装（registry/listener/provider/cleanup）。
 * @description 将 TcpService 的会话职责与运行时副作用解耦。
 */

import { invokeTauri, listenTcpFrame, TAURI_COMMANDS, tauriLog, type TcpMessageEvent } from "@/shared/tauri";
import { setTcpServiceProvider } from "@/shared/net/tcp/tcpServiceProvider";
import { registerServerScopeCleanupHandler } from "@/shared/utils/serverScopeLifecycle";
import type { Event, UnlistenFn } from "@tauri-apps/api/event";
import { TcpService } from "./TcpService";
import type { FrameConfig } from "./frameCodec";

/**
 * @constant
 * @description 全局 TCP service registry（key 为 server socket）。
 */
const TCP_SERVICE = new Map<string, TcpService>();
const TCP_SERVICE_INIT = new Map<string, { token: symbol; promise: Promise<TcpService> }>();
const DEFAULT_FRAME_CONFIG: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
const KEY_EXCHANGE_TIMEOUT_MS = 15_000;

let tcpFrameListenerSubscribed = false;
let tcpFrameListenerStartingPromise: Promise<void> | null = null;
let tcpFrameUnlisten: UnlistenFn | null = null;
let tcpServiceProviderRegistered = false;
let serverScopeCleanupHandlerRegistered = false;
let unregisterServerScopeCleanupHandler: (() => void) | null = null;

async function handleTcpFrameEvent(event: Event<TcpMessageEvent>): Promise<void> {
  const service = TCP_SERVICE.get(event.payload.server_socket);
  if (!service) return;

  const framePayload = new Uint8Array(event.payload.payload);
  const plaintext = await service.decodeIncomingFrame(framePayload);

  if (!plaintext || plaintext.trim().length === 0) return;
  try {
    await service.listen(plaintext, event.payload.server_socket);
  } catch (e) {
    tauriLog.error("Action: network_tcp_listen_failed", { error: String(e) });
  }
}

async function ensureTcpFrameListener(): Promise<void> {
  if (tcpFrameListenerSubscribed) return;
  if (tcpFrameListenerStartingPromise) {
    await tcpFrameListenerStartingPromise;
    return;
  }

  tcpFrameListenerStartingPromise = (async () => {
    try {
      tcpFrameUnlisten = await listenTcpFrame(handleTcpFrameEvent);
      tcpFrameListenerSubscribed = true;
    } catch (error) {
      tcpFrameListenerSubscribed = false;
      tauriLog.warn("Action: network_tcp_frame_listener_subscribe_failed", { error: String(error) });
      throw error;
    } finally {
      tcpFrameListenerStartingPromise = null;
    }
  })();

  await tcpFrameListenerStartingPromise;
}

function ensureTcpServiceProvider(): void {
  if (tcpServiceProviderRegistered) return;
  tcpServiceProviderRegistered = true;
  // 依赖倒置：由 server-connection/connectivity feature 提供 TcpService 获取方式，供 shared/net 基础设施消费（例如 BaseAPI）。
  setTcpServiceProvider((serverSocket: string) => TCP_SERVICE.get(String(serverSocket ?? "").trim()) ?? null);
}

function disposeTcpServiceByKey(key: string): void {
  const service = TCP_SERVICE.get(key);
  if (service) {
    service.dispose();
    TCP_SERVICE.delete(key);
  }
  TCP_SERVICE_INIT.delete(key);
  void invokeTauri(TAURI_COMMANDS.removeTcpService, { serverSocket: key }).catch((e) => {
    tauriLog.warn("Action: network_tcp_service_remove_failed", { key, error: String(e) });
  });
}

function ensureServerScopeCleanupHandler(): void {
  if (serverScopeCleanupHandlerRegistered) return;
  serverScopeCleanupHandlerRegistered = true;
  unregisterServerScopeCleanupHandler = registerServerScopeCleanupHandler((event) => {
    if (event.type === "all") {
      for (const key of Array.from(TCP_SERVICE.keys())) {
        disposeTcpServiceByKey(key);
      }
      return;
    }
    disposeTcpServiceByKey(event.key);
  });
}

/**
 * 创建并初始化某服务端的 `TcpService`（注册到全局 `TCP_SERVICE`，并完成握手）。
 *
 * 行为：
 * - 创建 service 并写入 registry；
 * - 启动换钥/握手流程（mock socket 可跳过等待）；
 * - 初始化失败时从 registry 移除，避免脏数据残留。
 *
 * @param serverSocket - 服务端 socket（作为 registry key）。
 * @param transportSocketInput - 实际用于原生连接器的传输 socket（默认同 `serverSocket`）。
 * @returns 已初始化（且在非 mock 下握手完成）的 `TcpService`。
 */
export async function createServerTcpService(
  serverSocket: string,
  transportSocketInput?: string,
): Promise<TcpService> {
  const serverSocketKey = serverSocket.trim();
  const transportSocket = String(transportSocketInput ?? serverSocketKey).trim() || serverSocketKey;
  // 参考 `docs/客户端开发指南.md`：
  // Netty 帧：2 字节无符号长度前缀（大端），后跟 payload（长度为 length）。
  const frameConfig = DEFAULT_FRAME_CONFIG;
  const isMockSocket = transportSocket.startsWith("mock://");

  const existing = TCP_SERVICE.get(serverSocketKey);
  if (existing) return existing;

  const creating = TCP_SERVICE_INIT.get(serverSocketKey);
  if (creating) return creating.promise;

  const initToken = Symbol(serverSocketKey);
  const initPromise = (async (): Promise<TcpService> => {
    const service = new TcpService(serverSocketKey, transportSocket, { frameConfig });
    TCP_SERVICE.set(serverSocketKey, service);

    tauriLog.debug("Action: network_tcp_service_initialization_started", { serverSocketKey, transportSocket, frameConfig });

    try {
      await service.waitForInit();
      await service.swapKey(0);
      tauriLog.debug("Action: network_handshake_started", { serverSocketKey, transportSocket, frameConfig });

      if (!isMockSocket) {
        await service.waitForKeyExchange(KEY_EXCHANGE_TIMEOUT_MS);
        tauriLog.debug("Action: network_handshake_completed", { serverSocketKey, transportSocket, frameConfig });
      } else {
        tauriLog.debug("Action: network_handshake_mock_bypassed", { serverSocketKey, transportSocket, frameConfig });
      }

      return service;
    } catch (e) {
      tauriLog.error("Action: network_tcp_service_initialization_failed", {
        serverSocketKey,
        transportSocket,
        frameConfig,
        error: String(e),
      });
      if (TCP_SERVICE.get(serverSocketKey) === service) {
        TCP_SERVICE.delete(serverSocketKey);
      }
      throw e;
    } finally {
      const current = TCP_SERVICE_INIT.get(serverSocketKey);
      if (current?.token === initToken) {
        TCP_SERVICE_INIT.delete(serverSocketKey);
      }
    }
  })();

  TCP_SERVICE_INIT.set(serverSocketKey, { token: initToken, promise: initPromise });
  return initPromise;
}

/**
 * 启动 TCP service 运行时（幂等）。
 *
 * 说明：
 * - 显式完成事件监听与 provider 注册；
 * - 避免模块加载时执行副作用。
 */
export async function startTcpServiceRuntime(): Promise<void> {
  await ensureTcpFrameListener();
  ensureTcpServiceProvider();
  ensureServerScopeCleanupHandler();
}

/**
 * 停止 TCP service 运行时（best-effort）。
 *
 * 说明：
 * - 释放事件监听与 provider 注入；
 * - 清理当前所有服务会话。
 */
export async function stopTcpServiceRuntime(): Promise<void> {
  if (tcpFrameUnlisten) {
    tcpFrameUnlisten();
    tcpFrameUnlisten = null;
  }
  tcpFrameListenerSubscribed = false;
  tcpFrameListenerStartingPromise = null;

  if (unregisterServerScopeCleanupHandler) {
    unregisterServerScopeCleanupHandler();
    unregisterServerScopeCleanupHandler = null;
  }
  serverScopeCleanupHandlerRegistered = false;

  if (tcpServiceProviderRegistered) {
    setTcpServiceProvider(() => null);
    tcpServiceProviderRegistered = false;
  }

  for (const key of Array.from(TCP_SERVICE.keys())) {
    disposeTcpServiceByKey(key);
  }
  TCP_SERVICE.clear();
  TCP_SERVICE_INIT.clear();
}
