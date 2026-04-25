/**
 * @fileoverview TcpRequestResponseSender.ts
 * @description server-connection/connectivity｜request/response 发送器（id 关联回包）。
 */

import { invokeTauri, TAURI_COMMANDS, tauriLog } from "@/shared/tauri";
import { TcpRequestCallbackRegistry } from "./TcpRequestCallbackRegistry";

type CreateTcpRequestResponseSenderDeps = {
  callbackRegistry: TcpRequestCallbackRegistry;
  callbackTimeoutById: Map<number, ReturnType<typeof setTimeout>>;
  encrypt(rawData: string): Promise<Uint8Array>;
  responseCallbackTimeoutMs: number;
};

/**
 * 创建 request/response 发送器（基于 callback id 关联回包）。
 */
export function createTcpRequestResponseSender(deps: CreateTcpRequestResponseSenderDeps) {
  /**
   * 发送 request 并等待同 id 响应。
   *
   * 契约：
   * - `rawData` 必须是 JSON object 字符串；
   * - 发送前会注入 `id` 字段（用于回包关联）；
   * - 以下场景会 reject：JSON 解析失败、发送失败、超时。
   */
  return function sendWithResponse(serverSocket: string, rawData: string): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const requestContext = {
        callbackId: -1,
        callbackTimeoutHandle: undefined as ReturnType<typeof setTimeout> | undefined,
        settled: false,
      };

      const settleResolve = (value: unknown): void => {
        if (requestContext.settled) return;
        requestContext.settled = true;
        resolve(value);
      };

      const settleReject = (error: unknown): void => {
        if (requestContext.settled) return;
        requestContext.settled = true;
        reject(error);
      };

      const clearCallbackTimeout = (): void => {
        if (!requestContext.callbackTimeoutHandle) return;
        clearTimeout(requestContext.callbackTimeoutHandle);
        requestContext.callbackTimeoutHandle = undefined;
        if (requestContext.callbackId !== -1) {
          deps.callbackTimeoutById.delete(requestContext.callbackId);
        }
      };

      const failAndCleanup = (error: unknown): void => {
        clearCallbackTimeout();
        if (requestContext.callbackId !== -1) {
          deps.callbackRegistry.remove(requestContext.callbackId);
        }
        tauriLog.error("Action: network_tcp_send_with_response_failed", {
          error: String(error),
        });
        settleReject(error);
      };

      const onResponse = (data: unknown): void => {
        clearCallbackTimeout();
        settleResolve(data);
      };

      requestContext.callbackId = deps.callbackRegistry.addOnce(onResponse);
      requestContext.callbackTimeoutHandle = setTimeout(() => {
        requestContext.callbackTimeoutHandle = undefined;
        deps.callbackTimeoutById.delete(requestContext.callbackId);
        deps.callbackRegistry.remove(requestContext.callbackId);
        tauriLog.warn("Action: network_tcp_send_with_response_callback_timeout", {
          id: requestContext.callbackId,
          timeoutMs: deps.responseCallbackTimeoutMs,
        });
        settleReject(new Error("TCP response timeout"));
      }, deps.responseCallbackTimeoutMs);
      deps.callbackTimeoutById.set(requestContext.callbackId, requestContext.callbackTimeoutHandle);

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(rawData) as Record<string, unknown>;
      } catch (error) {
        tauriLog.error("Action: network_tcp_send_with_response_payload_invalid_json", {
          error: String(error),
        });
        failAndCleanup(error);
        return;
      }

      payload.id = requestContext.callbackId;
      void deps
        .encrypt(JSON.stringify(payload))
        .then((data) =>
          invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket, data: Array.from(data) }),
        )
        .catch((error) => {
          failAndCleanup(error);
        });
    });
  };
}
