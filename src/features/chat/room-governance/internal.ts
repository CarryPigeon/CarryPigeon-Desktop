/**
 * @fileoverview chat/room-governance 运行时装配出口。
 * @description
 * 为 chat application/runtime 装配根提供 room-governance 子域的内部装配能力。
 */

export { createChannelAdminActions } from "./application/usecases/channelAdminActions";
export { createChannelUserActions } from "./application/usecases/channelUserActions";
