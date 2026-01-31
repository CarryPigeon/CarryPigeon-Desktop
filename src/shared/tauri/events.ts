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

export type TcpMessageEvent = { server_socket: string; payload: number[] };
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

export type UserProfileResponse = { id: string; ok: boolean; message?: string };

/**
 * 监听 TCP 消息事件（由 Rust 侧发出）。
 * @param handler - 事件处理函数
 * @returns 取消监听函数（UnlistenFn）的 Promise
 */
export function listenTcpMessage(
  handler: (event: Event<TcpMessageEvent>) => void,
): Promise<UnlistenFn> {
  return listen<TcpMessageEvent>(TAURI_EVENTS.tcpMessage, handler);
}

/**
 * 监听 TCP 拆包后的帧事件（Rust 侧按 Netty length-prefix 进行拆包后发出）。
 * @param handler - 事件处理函数
 * @returns 取消监听函数（UnlistenFn）的 Promise
 */
export function listenTcpFrame(
  handler: (event: Event<TcpMessageEvent>) => void,
): Promise<UnlistenFn> {
  return listen<TcpMessageEvent>(TAURI_EVENTS.tcpFrame, handler);
}

/**
 * emitUserProfileRequest 方法说明。
 * @param payload - 参数说明。
 * @returns 返回值说明。
 */
export function emitUserProfileRequest(payload: UserProfileRequest): Promise<void> {
  return emit(TAURI_EVENTS.userProfileRequest, payload);
}

/**
 * listenUserProfileRequest function.
 * @param handler - TODO.
 * @returns TODO.
 */
export function listenUserProfileRequest(
  handler: (event: Event<UserProfileRequest>) => void,
): Promise<UnlistenFn> {
  return listen<UserProfileRequest>(TAURI_EVENTS.userProfileRequest, handler);
}

/**
 * emitUserProfileResponse 方法说明。
 * @param payload - 参数说明。
 * @returns 返回值说明。
 */
export function emitUserProfileResponse(payload: UserProfileResponse): Promise<void> {
  return emit(TAURI_EVENTS.userProfileResponse, payload);
}

/**
 * listenUserProfileResponse function.
 * @param handler - TODO.
 * @returns TODO.
 */
export function listenUserProfileResponse(
  handler: (event: Event<UserProfileResponse>) => void,
): Promise<UnlistenFn> {
  return listen<UserProfileResponse>(TAURI_EVENTS.userProfileResponse, handler);
}
