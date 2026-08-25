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
import {
  createAuditLogCapabilities,
  getAuditLogCapabilities,
} from "@/features/chat/audit-logs/api";
import type { ChatAuditLogCapabilities } from "@/features/chat/audit-logs/api-types";
import {
  createChannelDiscoveryCapabilities,
  getChannelDiscoveryCapabilities,
} from "@/features/chat/channel-discovery/api";
import type { ChannelDiscoveryCapabilities } from "@/features/chat/channel-discovery/api-types";
import {
  createMentionInboxCapabilities,
  getMentionInboxCapabilities,
} from "@/features/chat/mention-inbox/api";
import type { MentionInboxCapabilities } from "@/features/chat/mention-inbox/api-types";

// 只要任一 API 缺失必需字段/函数，typecheck 会在这里失败。
/**
 * room-session capability 工厂返回值契约检查。
 */
export const roomSessionCapabilitiesContractCheck: RoomSessionCapabilities = createRoomSessionCapabilities();
/**
 * room-session capability accessor 返回值契约检查。
 */
export const roomSessionCapabilitiesAccessorCheck: RoomSessionCapabilities = getRoomSessionCapabilities();
/**
 * message-flow capability 工厂返回值契约检查。
 */
export const messageFlowCapabilitiesContractCheck: MessageFlowCapabilities = createMessageFlowCapabilities();
/**
 * message-flow capability accessor 返回值契约检查。
 */
export const messageFlowCapabilitiesAccessorCheck: MessageFlowCapabilities = getMessageFlowCapabilities();
/**
 * room-governance capability 工厂返回值契约检查。
 */
export const roomGovernanceCapabilitiesContractCheck: RoomGovernanceCapabilities = createRoomGovernanceCapabilities();
/**
 * room-governance capability accessor 返回值契约检查。
 */
export const roomGovernanceCapabilitiesAccessorCheck: RoomGovernanceCapabilities = getRoomGovernanceCapabilities();
/**
 * chat 根 capability 返回值契约检查。
 */
export const chatCapabilitiesContractCheck: ChatCapabilities = createChatCapabilities();

/**
 * room-session 目录 capability 的 `ReadableCapability` 契约检查。
 */
export const roomSessionDirectoryReadableContractCheck: ReadableCapability<
  ReturnType<RoomSessionCapabilities["directory"]["getSnapshot"]>
> = roomSessionCapabilitiesContractCheck.directory;

/**
 * room-session 当前频道 capability 的 `ReadableCapability` 契约检查。
 */
export const roomSessionCurrentChannelReadableContractCheck: ReadableCapability<
  ReturnType<RoomSessionCapabilities["currentChannel"]["getSnapshot"]>
> = roomSessionCapabilitiesContractCheck.currentChannel;

/**
 * message-flow 当前频道 capability 的 `ReadableCapability` 契约检查。
 */
export const messageFlowCurrentChannelReadableContractCheck: ReadableCapability<
  ReturnType<MessageFlowCapabilities["currentChannel"]["getSnapshot"]>
> = messageFlowCapabilitiesContractCheck.currentChannel;

/**
 * message-flow composer capability 的 `ReadableCapability` 契约检查。
 */
export const messageFlowComposerReadableContractCheck: ReadableCapability<
  ReturnType<MessageFlowCapabilities["composer"]["getSnapshot"]>
> = messageFlowCapabilitiesContractCheck.composer;

/**
 * governance 当前成员 capability 的 `ReadableCapability` 契约检查。
 */
export const governanceMembersReadableContractCheck: ReadableCapability<
  ReturnType<RoomGovernanceCapabilities["currentChannel"]["members"]["getSnapshot"]>
> = roomGovernanceCapabilitiesContractCheck.currentChannel.members;

/**
 * 频道发现 capability 契约检查。
 */
export const channelDiscoveryCapabilitiesContractCheck: ChannelDiscoveryCapabilities = createChannelDiscoveryCapabilities();
export const channelDiscoveryCapabilitiesAccessorCheck: ChannelDiscoveryCapabilities = getChannelDiscoveryCapabilities();
export const channelDiscoveryReadableContractCheck: ReadableCapability<
  ReturnType<ChannelDiscoveryCapabilities["getSnapshot"]>
> = channelDiscoveryCapabilitiesContractCheck;

/**
 * 提及收件箱 capability 契约检查。
 */
export const mentionInboxCapabilitiesContractCheck: MentionInboxCapabilities = createMentionInboxCapabilities();
export const mentionInboxCapabilitiesAccessorCheck: MentionInboxCapabilities = getMentionInboxCapabilities();
export const mentionInboxReadableContractCheck: ReadableCapability<
  ReturnType<MentionInboxCapabilities["getSnapshot"]>
> = mentionInboxCapabilitiesContractCheck;

/**
 * 审计日志 capability 契约检查。
 */
export const auditLogCapabilitiesContractCheck: ChatAuditLogCapabilities = createAuditLogCapabilities();
export const auditLogCapabilitiesAccessorCheck: ChatAuditLogCapabilities = getAuditLogCapabilities();
