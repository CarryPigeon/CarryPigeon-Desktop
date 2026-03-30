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

/**
 * chat 对外目录快照。
 *
 * 这是 room-session 目录快照在 chat 根公共 API 上的重导出别名，
 * 目的是让跨 feature 调用方不必理解子域内部命名。
 */
export type ChatSessionDirectorySnapshot = RoomSessionDirectorySnapshot;
/**
 * chat 对外当前频道会话快照。
 */
export type ChatCurrentChannelSessionSnapshot = CurrentChannelSessionSnapshot;
/**
 * chat 对外当前频道时间线快照。
 */
export type ChatCurrentChannelMessageTimelineSnapshot = MessageTimelineSnapshot;
/**
 * chat 对外 composer 快照。
 */
export type ChatMessageComposerSnapshot = MessageComposerSnapshot;
/**
 * chat 根公共 API 上的目录 capability。
 */
export type ChatSessionDirectoryCapabilities = RoomSessionDirectoryCapabilities;
/**
 * chat 根公共 API 上的当前频道会话 capability。
 */
export type ChatCurrentChannelSessionCapabilities = CurrentChannelSessionCapabilities;
/**
 * chat 根公共 API 上的 room-session 能力分组。
 */
export type ChatSessionCapabilities = RoomSessionCapabilities;
/**
 * chat 根公共 API 上的当前频道 message-flow capability。
 */
export type ChatCurrentChannelMessageFlowCapabilities = MessageTimelineCapabilities;
/**
 * chat 根公共 API 上的按频道消息查询 capability。
 */
export type ChatChannelMessageLookupCapabilities = ChannelMessageLookupCapabilities;
/**
 * chat 根公共 API 上的 composer capability。
 */
export type ChatMessageComposerCapabilities = MessageComposerCapabilities;
/**
 * chat 根公共 API 上的 message-flow 能力分组。
 */
export type ChatMessageFlowCapabilities = MessageFlowCapabilities;
/**
 * chat 根公共 API 上的当前频道治理 capability。
 */
export type ChatCurrentChannelGovernanceCapabilities = CurrentChannelGovernanceCapabilities;
/**
 * chat 根公共 API 上的按频道治理 capability。
 */
export type ChatChannelGovernanceCapabilities = ChannelGovernanceCapabilities;
/**
 * chat 根公共 API 上的治理成员快照。
 */
export type ChatGovernanceMembersSnapshot = RoomGovernanceMembersSnapshot;
/**
 * chat 根公共 API 上的 governance 能力分组。
 */
export type ChatGovernanceCapabilities = RoomGovernanceCapabilities;

/**
 * chat feature 对外暴露的完整 capability 根对象。
 *
 * 这是跨 feature 使用 chat 的唯一稳定值语义入口。
 */
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
