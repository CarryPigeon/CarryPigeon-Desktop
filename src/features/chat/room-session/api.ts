/**
 * @fileoverview chat/room-session 对外 API。
 * @description
 * 暴露会话上下文与连接期编排能力（频道目录、当前频道、就绪、已读上报）。
 */

import type { RoomSessionCapabilities } from "./api-types";
import { createRoomSessionCapabilitySource } from "./capability-source";

/**
 * 创建 room-session 子域能力对象。
 */
export function createRoomSessionCapabilities(): RoomSessionCapabilities {
  return createRoomSessionCapabilitySource();
}

let roomSessionCapabilitiesSingleton: RoomSessionCapabilities | null = null;

/**
 * 获取 room-session 子域共享能力对象。
 *
 * 约定：
 * - feature 内部默认共享同一个 capability 实例；
 * - 跨 feature 应优先通过 `chat/public/api.ts` 获取聚合后的根 capability。
 */
export function getRoomSessionCapabilities(): RoomSessionCapabilities {
  roomSessionCapabilitiesSingleton ??= createRoomSessionCapabilities();
  return roomSessionCapabilitiesSingleton;
}
