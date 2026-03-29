/**
 * @fileoverview chat/room-governance 运行时装配出口。
 * @description
 * 为 chat composition root 提供 room-governance 子域的内部装配能力。
 */

export { createChannelAdminActions } from "./application/channelAdminActions";
export { createChannelUserActions } from "./application/channelUserActions";
export { createGovernanceEventRouter } from "./presentation/store/governanceEventRouter";
