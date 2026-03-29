/**
 * @fileoverview room-governance 展示契约。
 * @description
 * 由 room-governance 子域持有的稳定公共治理模型。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { ChannelSummary } from "@/features/chat/contracts/channelSummary";

/**
 * 治理子域使用的频道摘要模型。
 */
export type GovernanceChannelSummary = ChannelSummary;

/**
 * 频道成员（轻量展示）。
 */
export type ChatMember = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

/**
 * 频道成员（管理页模型）。
 */
export type ChannelMember = {
  uid: string;
  nickname: string;
  avatar?: string;
  role: "owner" | "admin" | "member" | string;
  joinTime: number;
};

/**
 * 入群申请条目（管理页模型）。
 */
export type ChannelApplication = {
  applicationId: string;
  cid: string;
  uid: string;
  nickname?: string;
  avatar?: string;
  reason: string;
  applyTime: number;
  status: "pending" | "approved" | "rejected" | string;
};

/**
 * 封禁条目（管理页模型）。
 */
export type ChannelBan = {
  cid: string;
  uid: string;
  nickname?: string;
  avatar?: string;
  until: number;
  reason: string;
  createTime: number;
};

export type GovernanceCommandErrorCode =
  | "missing_channel_id"
  | "missing_user_id"
  | "missing_application_id"
  | "missing_channel_name"
  | "not_signed_in"
  | "stale_runtime_scope"
  | "governance_action_failed";

export type GovernanceCommandErrorInfo = SemanticErrorInfo<GovernanceCommandErrorCode>;

type GovernanceActionOutcome<TKind extends string, TPayload extends Record<string, unknown> = Record<string, never>> =
  | SuccessOutcome<TKind, TPayload>
  | FailureOutcome<`${TKind}_rejected`, GovernanceCommandErrorCode>;

export type ApplyJoinChannelOutcome = GovernanceActionOutcome<"channel_join_applied", { channelId: string }>;
export type UpdateChannelMetaOutcome = GovernanceActionOutcome<"channel_meta_updated", { channelId: string }>;
export type CreateChannelOutcome = GovernanceActionOutcome<"channel_created", { channel: GovernanceChannelSummary }>;
export type DeleteChannelOutcome = GovernanceActionOutcome<"channel_deleted", { channelId: string }>;
export type KickChannelMemberOutcome = GovernanceActionOutcome<"channel_member_kicked", { channelId: string; uid: string }>;
export type GrantChannelAdminOutcome = GovernanceActionOutcome<"channel_admin_granted", { channelId: string; uid: string }>;
export type RevokeChannelAdminOutcome = GovernanceActionOutcome<"channel_admin_revoked", { channelId: string; uid: string }>;
export type DecideChannelApplicationOutcome = GovernanceActionOutcome<
  "channel_application_decided",
  { channelId: string; applicationId: string; decision: "approve" | "reject" }
>;
export type SetChannelBanOutcome = GovernanceActionOutcome<"channel_ban_upserted", { channelId: string; uid: string; until: number }>;
export type RemoveChannelBanOutcome = GovernanceActionOutcome<"channel_ban_removed", { channelId: string; uid: string }>;
