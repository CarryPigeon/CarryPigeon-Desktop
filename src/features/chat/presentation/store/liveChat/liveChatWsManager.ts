/**
 * @fileoverview liveChat WS 连接管理器（连接/复用/关闭/reauth）。
 * @description chat｜展示层状态（store）：liveChatWsManager。
 *
 * 说明：
 * - 该模块只管理“连接句柄与 key 绑定”，不决定何时应当使用 WS（策略由 store 决定）；
 * - 通过 `ensureConnected` 保证“同一 socket key 下复用连接、切换 key 时自动重连”；
 * - `reauthIfConnectedFor` 用于在 access token 刷新后更新 WS 鉴权。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不直接输出日志）。
 */

import type { ChatEventsClient, ChatEventsConnectOptions, ChatEventsPort } from "@/features/chat/domain/ports/chatEventsPort";
import type { WsEventDto } from "@/features/chat/domain/types/chatWireEvents";

/**
 * WS 连接管理器接口：负责连接句柄的复用、关闭与 reauth。
 */
export type LiveChatWsManager = {
  /**
   * 判断当前是否已为指定 socket key 建立连接。
   *
   * @param socketKey - 服务端 socket key。
   * @returns 若已连接且 key 匹配返回 true。
   */
  isConnectedFor(socketKey: string): boolean;
  /**
   * 关闭当前连接（幂等）。
   *
   * @returns void。
   */
  close(): void;
  /**
   * 确保已连接到指定 socket key。
   *
   * 说明：
   * - 若已为同一 key 连接，则不重复连接；
   * - 若当前连接属于其他 key，则先关闭再新建连接。
   *
   * @param socketKey - 服务端 socket key。
   * @param accessToken - Bearer access token。
   * @param onEvent - WS 事件回调。
   * @param options - 连接选项（回调/override 等）。
   * @returns void。
   */
  ensureConnected(
    socketKey: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): void;
  /**
   * 若当前连接属于指定 key，则执行 reauth。
   *
   * @param socketKey - 服务端 socket key。
   * @param nextAccessToken - 新 access token。
   * @returns void。
   */
  reauthIfConnectedFor(socketKey: string, nextAccessToken: string): void;
};

/**
 * 创建 WS 连接管理器。
 *
 * @param events - chatEvents 端口实现。
 * @returns LiveChatWsManager。
 */
export function createLiveChatWsManager(events: ChatEventsPort): LiveChatWsManager {
  let client: ChatEventsClient | null = null;
  let key: string = "";

  /**
   * 关闭当前连接（幂等）。
   *
   * @returns void。
   */
  function close(): void {
    if (!client) return;
    client.close();
    client = null;
    key = "";
  }

  /**
   * 判断当前是否已为指定 socket key 建立连接。
   *
   * @param socketKey - 服务端 socket key。
   * @returns 若已连接且 key 匹配返回 true。
   */
  function isConnectedFor(socketKey: string): boolean {
    const nextKey = String(socketKey ?? "").trim();
    return Boolean(client) && Boolean(nextKey) && key === nextKey;
  }

  /**
   * 确保已连接到指定 socket key。
   *
   * @param socketKey - 服务端 socket key。
   * @param accessToken - Bearer access token。
   * @param onEvent - WS 事件回调。
   * @param options - 连接选项（回调/override 等）。
   * @returns void。
   */
  function ensureConnected(
    socketKey: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): void {
    const nextKey = String(socketKey ?? "").trim();
    if (!nextKey) return;
    if (isConnectedFor(nextKey)) return;
    close();
    key = nextKey;
    client = events.connect(nextKey, accessToken, onEvent, options);
  }

  /**
   * 若当前连接属于指定 key，则执行 reauth。
   *
   * @param socketKey - 服务端 socket key。
   * @param nextAccessToken - 新 access token。
   * @returns void。
   */
  function reauthIfConnectedFor(socketKey: string, nextAccessToken: string): void {
    if (!client) return;
    const nextKey = String(socketKey ?? "").trim();
    if (!nextKey || key !== nextKey) return;
    const token = String(nextAccessToken ?? "").trim();
    if (!token) return;
    client.reauth(token);
  }

  return { isConnectedFor, close, ensureConnected, reauthIfConnectedFor };
}
