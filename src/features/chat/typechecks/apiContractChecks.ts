/**
 * @fileoverview chat API 编译期契约检查。
 * @description
 * 该文件仅用于 TypeScript 编译期检查：
 * - 子域 API 至少满足各自 contract；
 * - chat 根入口至少满足 `ChatCapabilities` 公共能力契约。
 */

import { createChatCapabilities } from "@/features/chat/public/api";
import type { ChatCapabilities } from "@/features/chat/public/api-types";
import type { ReadableCapability } from "@/shared/types/capabilities";
import {
  createMessageFlowCapabilities,
  getMessageFlowCapabilities,
} from "@/features/chat/message-flow/api";
import type { MessageFlowCapabilities } from "@/features/chat/message-flow/api-types";
import {
  createRoomGovernanceCapabilities,
  getRoomGovernanceCapabilities,
} from "@/features/chat/room-governance/api";
import type { RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";
import {
  createRoomSessionCapabilities,
  getRoomSessionCapabilities,
} from "@/features/chat/room-session/api";
import type { RoomSessionCapabilities } from "@/features/chat/room-session/api-types";

// 只要任一 API 缺失必需字段/函数，typecheck 会在这里失败。
export const roomSessionCapabilitiesContractCheck: RoomSessionCapabilities = createRoomSessionCapabilities();
export const roomSessionCapabilitiesAccessorCheck: RoomSessionCapabilities = getRoomSessionCapabilities();
export const messageFlowCapabilitiesContractCheck: MessageFlowCapabilities = createMessageFlowCapabilities();
export const messageFlowCapabilitiesAccessorCheck: MessageFlowCapabilities = getMessageFlowCapabilities();
export const roomGovernanceCapabilitiesContractCheck: RoomGovernanceCapabilities = createRoomGovernanceCapabilities();
export const roomGovernanceCapabilitiesAccessorCheck: RoomGovernanceCapabilities = getRoomGovernanceCapabilities();
export const chatCapabilitiesContractCheck: ChatCapabilities = createChatCapabilities();

export const roomSessionDirectoryReadableContractCheck: ReadableCapability<
  ReturnType<RoomSessionCapabilities["directory"]["getSnapshot"]>
> = roomSessionCapabilitiesContractCheck.directory;

export const roomSessionCurrentChannelReadableContractCheck: ReadableCapability<
  ReturnType<RoomSessionCapabilities["currentChannel"]["getSnapshot"]>
> = roomSessionCapabilitiesContractCheck.currentChannel;

export const messageFlowCurrentChannelReadableContractCheck: ReadableCapability<
  ReturnType<MessageFlowCapabilities["currentChannel"]["getSnapshot"]>
> = messageFlowCapabilitiesContractCheck.currentChannel;

export const messageFlowComposerReadableContractCheck: ReadableCapability<
  ReturnType<MessageFlowCapabilities["composer"]["getSnapshot"]>
> = messageFlowCapabilitiesContractCheck.composer;

export const governanceMembersReadableContractCheck: ReadableCapability<
  ReturnType<RoomGovernanceCapabilities["currentChannel"]["members"]["getSnapshot"]>
> = roomGovernanceCapabilitiesContractCheck.currentChannel.members;
