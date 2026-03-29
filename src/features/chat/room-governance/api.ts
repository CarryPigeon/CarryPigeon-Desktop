/**
 * @fileoverview chat/room-governance 对外 API。
 * @description
 * 暴露频道治理能力（成员、申请、禁言、频道管理）。
 */

import type {
  RoomGovernanceCapabilities,
} from "./api-types";
import { createRoomGovernanceCapabilitySource } from "./capability-source";

/**
 * 创建 room-governance 子域能力对象。
 */
export function createRoomGovernanceCapabilities(): RoomGovernanceCapabilities {
  return createRoomGovernanceCapabilitySource();
}

let roomGovernanceCapabilitiesSingleton: RoomGovernanceCapabilities | null = null;

/**
 * 获取 room-governance 子域共享能力对象。
 */
export function getRoomGovernanceCapabilities(): RoomGovernanceCapabilities {
  roomGovernanceCapabilitiesSingleton ??= createRoomGovernanceCapabilities();
  return roomGovernanceCapabilitiesSingleton;
}
