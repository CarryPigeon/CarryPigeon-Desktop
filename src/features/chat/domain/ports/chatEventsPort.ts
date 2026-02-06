/**
 * @fileoverview chatEventsPort.ts
 * @description chat｜领域端口：chatEventsPort。
 *
 * 说明：
 * - 该端口抽象“推送通道”（通常为 WebSocket）。
 * - `connect` 的能力刻意保持“窄接口”：由 store 基于会话变更与 UI 生命周期驱动 reauth/close。
 */

import type { WsEventDto } from "../types/chatWireEvents";

/**
 * 事件流连接句柄（由 data 层实现返回）。
 *
 * 说明：
 * - store 负责在 token 变更/页面卸载时调用 close；
 * - 若 access token 刷新，可调用 reauth 进行无感续期（由实现决定是否支持）。
 */
export type ChatEventsClient = {
  /**
   * 关闭底层连接，并停止内部定时器。
   */
  close(): void;
  /**
   * 使用新的 access token 对连接进行 reauth。
   *
   * @param nextAccessToken - 新 access token。
   */
  reauth(nextAccessToken: string): void;
};

/**
 * 事件流连接可选项（用于 override 与回调）。
 */
export type ChatEventsConnectOptions = {
  /**
   * 可选：由 `GET /api/server` 返回的明确 WS 端点（`ws_url`）。
   *
   * 说明：
   * - 当提供该字段时，client 应优先使用它，而不是默认的 `${origin}/api/ws` 拼接规则，
   *   以支持自定义 WS 路由。
   */
  wsUrlOverride?: string;
  /**
   * 当服务端报告无法 resume 时回调；客户端必须通过 HTTP（request/response）补拉追平。
   */
  onResumeFailed?: (reason: string) => void;
  /**
   * 当服务端拒绝 auth/reauth 时回调；客户端应刷新 token 并重连（或按策略降级）。
   */
  onAuthError?: (reason: string) => void;
};

/**
 * 聊天事件流端口（domain 层）。
 *
 * 说明：
 * - 该端口抽象推送通道（通常为 WebSocket）；
 * - 具体实现由 data 层提供（真实 WS vs mock）。
 */
export type ChatEventsPort = {
  /**
   * 连接聊天事件流并完成鉴权。
   *
   * @param serverSocket - 用于推导 origin 的 server socket。
   * @param accessToken - Bearer access token。
   * @param onEvent - 事件 envelope 回调。
   * @param options - 可选：连接回调与 override。
   * @returns client 句柄。
   */
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};
