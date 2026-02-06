/**
 * @fileoverview Tauri 事件名与监听工具。
 */
import { emit, listen, type Event, type UnlistenFn } from "@tauri-apps/api/event";

/**
 * @constant
 * @description Rust -> 前端事件名集合（Tauri events）。
 */
export const TAURI_EVENTS = {
  tcpMessage: "tcp-message",
  tcpFrame: "tcp-frame",
  userProfileRequest: "user-profile-request",
  userProfileResponse: "user-profile-response",
} as const;

/**
 * TCP 消息事件载荷（Rust -> 前端）。
 *
 * 说明：
 * - `server_socket` 用于在前端按 server scope 路由到正确的 store；
 * - `payload` 为 byte 数组（framed 或 deframed 由事件名决定）。
 */
export type TcpMessageEvent = { server_socket: string; payload: number[] };

/**
 * user-profile 请求事件载荷（frontend -> frontend，经由 Tauri event bus）。
 */
export type UserProfileRequest =
  | { id: string; type: "send_email_code"; email: string }
  | { id: string; type: "logout" }
  | {
      id: string;
      type: "update_profile";
      profile: {
        username: string;
        avatar: number;
        sex: number;
        brief: string;
        birthday: number;
      };
      emailUpdate?: {
        email: string;
        code: string;
      };
    };

/**
 * user-profile 响应事件载荷（frontend -> frontend，经由 Tauri event bus）。
 */
export type UserProfileResponse = { id: string; ok: boolean; message?: string };

/**
 * 监听 TCP 消息事件（由 Rust 侧发出）。
 *
 * @param handler - 事件处理函数。
 * @returns 取消监听函数（UnlistenFn）。
 */
export function listenTcpMessage(
  handler: (event: Event<TcpMessageEvent>) => void,
): Promise<UnlistenFn> {
  return listen<TcpMessageEvent>(TAURI_EVENTS.tcpMessage, handler);
}

/**
 * 监听 TCP 拆包后的帧事件（Rust 侧按 Netty length-prefix 进行拆包后发出）。
 *
 * @param handler - 事件处理函数。
 * @returns 取消监听函数（UnlistenFn）。
 */
export function listenTcpFrame(
  handler: (event: Event<TcpMessageEvent>) => void,
): Promise<UnlistenFn> {
  return listen<TcpMessageEvent>(TAURI_EVENTS.tcpFrame, handler);
}

/**
 * 发出 user-profile 请求事件（frontend → frontend，通过 Tauri event bus）。
 *
 * @param payload - 请求载荷。
 * @returns 无返回值。
 */
export function emitUserProfileRequest(payload: UserProfileRequest): Promise<void> {
  return emit(TAURI_EVENTS.userProfileRequest, payload);
}

/**
 * 监听 user-profile 请求事件。
 *
 * @param handler - 事件处理函数。
 * @returns 取消监听函数（UnlistenFn）的 Promise。
 */
export function listenUserProfileRequest(
  handler: (event: Event<UserProfileRequest>) => void,
): Promise<UnlistenFn> {
  return listen<UserProfileRequest>(TAURI_EVENTS.userProfileRequest, handler);
}

/**
 * 发出 user-profile 响应事件。
 *
 * @param payload - 响应载荷。
 * @returns 无返回值。
 */
export function emitUserProfileResponse(payload: UserProfileResponse): Promise<void> {
  return emit(TAURI_EVENTS.userProfileResponse, payload);
}

/**
 * 监听 user-profile 响应事件。
 *
 * @param handler - 事件处理函数。
 * @returns 取消监听函数（UnlistenFn）的 Promise。
 */
export function listenUserProfileResponse(
  handler: (event: Event<UserProfileResponse>) => void,
): Promise<UnlistenFn> {
  return listen<UserProfileResponse>(TAURI_EVENTS.userProfileResponse, handler);
}
