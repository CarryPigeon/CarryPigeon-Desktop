/**
 * @fileoverview 会话状态重置与资源清理（server 切换场景）。
 * @description chat/room-session｜application：server 切换时的会话状态重置。
 *
 * 背景：
 * - chat session store 是“按 server socket”维度的状态机；
 * - 当用户切换 server（或 server socket 变化）时，必须清理旧连接/定时器，并重置所有缓存状态，
 *   避免消息/成员/分页 cursor 等跨 server 泄漏。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { RoomSessionStatePort } from "../ports/sessionPorts";

/**
 * room-session 重置器的依赖集合。
 */
export type ResetRoomSessionStateDeps = {
  /**
   * 释放当前 server scope 下的连接链路资源。
   *
   * 说明：
   * - 由上层连接生命周期运行时提供；
   * - 内部负责关闭 WS、停止 polling、解绑会话 hooks。
   */
  teardownConnectionLifecycle: () => void;
  state: Pick<
    RoomSessionStatePort,
    | "clearChannelDirectory"
    | "clearMembers"
    | "clearCurrentChannel"
    | "clearAllMessageCaches"
    | "clearAllReadMarkers"
    | "clearPaginationState"
    | "incrementScopeVersion"
    | "clearMessageActionState"
    | "resetComposerState"
  >;
};

/**
 * 重置 room-session 的全部状态，并清理资源（WS/轮询/会话钩子）。
 *
 * @param deps - 依赖注入。
 * @returns void。
 */
export function resetRoomSessionState(deps: ResetRoomSessionStateDeps): void {
  deps.teardownConnectionLifecycle();

  deps.state.clearChannelDirectory();
  deps.state.clearMembers();
  deps.state.clearCurrentChannel();
  deps.state.clearAllMessageCaches();
  deps.state.clearAllReadMarkers();
  deps.state.clearPaginationState();
  deps.state.incrementScopeVersion();
  deps.state.clearMessageActionState();
  deps.state.resetComposerState();
}
