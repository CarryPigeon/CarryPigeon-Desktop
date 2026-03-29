/**
 * @fileoverview chat Feature 公共类型出口。
 * @description
 * 仅导出 chat 对外稳定可见的公共契约，避免把内部聚合/运行时实现或 Vue 视图对象暴露为公共 API。
 */

import type {
  CurrentChannelSessionCapabilities,
  CurrentChannelSessionSnapshot,
  RoomSessionCapabilities,
  RoomSessionDirectoryCapabilities,
  RoomSessionDirectorySnapshot,
} from "../room-session/api-types";
import type {
  ChannelMessageLookupCapabilities,
  MessageComposerCapabilities,
  MessageComposerSnapshot,
  MessageFlowCapabilities,
  MessageTimelineCapabilities,
  MessageTimelineSnapshot,
} from "../message-flow/api-types";
import type {
  ChannelGovernanceCapabilities,
  CurrentChannelGovernanceCapabilities,
  RoomGovernanceCapabilities,
  RoomGovernanceMembersSnapshot,
} from "../room-governance/api-types";

export type {
  ChannelSelectionErrorInfo,
  ChannelSelectionOutcome,
  ChatChannel,
} from "../room-session/api-types";
export type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "../message-flow/api-types";
export type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  ChatMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GovernanceCommandErrorInfo,
  GrantChannelAdminOutcome,
  GovernanceChannelSummary,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "../room-governance/api-types";

export type ChatSessionDirectorySnapshot = RoomSessionDirectorySnapshot;
export type ChatCurrentChannelSessionSnapshot = CurrentChannelSessionSnapshot;
export type ChatCurrentChannelMessageTimelineSnapshot = MessageTimelineSnapshot;
export type ChatMessageComposerSnapshot = MessageComposerSnapshot;
export type ChatSessionDirectoryCapabilities = RoomSessionDirectoryCapabilities;
export type ChatCurrentChannelSessionCapabilities = CurrentChannelSessionCapabilities;
export type ChatSessionCapabilities = RoomSessionCapabilities;
export type ChatCurrentChannelMessageFlowCapabilities = MessageTimelineCapabilities;
export type ChatChannelMessageLookupCapabilities = ChannelMessageLookupCapabilities;
export type ChatMessageComposerCapabilities = MessageComposerCapabilities;
export type ChatMessageFlowCapabilities = MessageFlowCapabilities;
export type ChatCurrentChannelGovernanceCapabilities = CurrentChannelGovernanceCapabilities;
export type ChatChannelGovernanceCapabilities = ChannelGovernanceCapabilities;
export type ChatGovernanceMembersSnapshot = RoomGovernanceMembersSnapshot;
export type ChatGovernanceCapabilities = RoomGovernanceCapabilities;

export type ChatCapabilities = {
  /**
   * chat 会话能力分组。
   */
  session: ChatSessionCapabilities;

  /**
   * chat 消息流能力分组。
   */
  messageFlow: ChatMessageFlowCapabilities;

  /**
   * chat 治理能力分组。
   */
  governance: ChatGovernanceCapabilities;
};
