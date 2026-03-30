/**
 * @fileoverview room-governance 领域契约。
 * @description
 * 由 room-governance 子域持有的稳定公共治理模型。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";

/**
 * 治理子域使用的频道摘要模型。
 *
 * 治理子域在频道基础资料上复用共享摘要，
 * 仅在治理特有数据上增加自己的模型。
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
 *
 * 区别于 `ChatMember`：
 * - `ChatMember` 是 members rail 轻量投影；
 * - `ChannelMember` 是治理页完整读模型。
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
 *
 * 这是治理页列表模型，不等同于底层 wire DTO。
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
 *
 * `until = 0` 表示永久封禁，页面层不需要再猜测该约定。
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

/**
 * room-governance 命令错误码。
 */
export type GovernanceCommandErrorCode =
  | "missing_channel_id"
  | "missing_user_id"
  | "missing_application_id"
  | "missing_channel_name"
  | "not_signed_in"
  | "stale_runtime_scope"
  | "governance_action_failed";

/**
 * room-governance 命令失败时的稳定错误代数。
 */
export type GovernanceCommandErrorInfo = SemanticErrorInfo<GovernanceCommandErrorCode>;

/**
 * 治理命令通用 Outcome 模板。
 *
 * 统一规则：
 * - 成功 kind 只表达“动作已完成”；
 * - 失败 kind 统一追加 `_rejected`，并返回稳定错误码。
 */
type GovernanceActionOutcome<TKind extends string, TPayload extends Record<string, unknown> = Record<string, never>> =
  | SuccessOutcome<TKind, TPayload>
  | FailureOutcome<`${TKind}_rejected`, GovernanceCommandErrorCode>;

/**
 * 申请加入频道结果。
 */
export type ApplyJoinChannelOutcome = GovernanceActionOutcome<"channel_join_applied", { channelId: string }>;
/**
 * 更新频道元信息结果。
 */
export type UpdateChannelMetaOutcome = GovernanceActionOutcome<"channel_meta_updated", { channelId: string }>;
/**
 * 创建频道结果。
 */
export type CreateChannelOutcome = GovernanceActionOutcome<"channel_created", { channel: GovernanceChannelSummary }>;
/**
 * 删除频道结果。
 */
export type DeleteChannelOutcome = GovernanceActionOutcome<"channel_deleted", { channelId: string }>;
/**
 * 移除频道成员结果。
 */
export type KickChannelMemberOutcome = GovernanceActionOutcome<"channel_member_kicked", { channelId: string; uid: string }>;
/**
 * 授予频道管理员结果。
 */
export type GrantChannelAdminOutcome = GovernanceActionOutcome<"channel_admin_granted", { channelId: string; uid: string }>;
/**
 * 撤销频道管理员结果。
 */
export type RevokeChannelAdminOutcome = GovernanceActionOutcome<"channel_admin_revoked", { channelId: string; uid: string }>;
/**
 * 审批入群申请结果。
 */
export type DecideChannelApplicationOutcome = GovernanceActionOutcome<
  "channel_application_decided",
  { channelId: string; applicationId: string; decision: "approve" | "reject" }
>;
/**
 * 设置频道封禁结果。
 */
export type SetChannelBanOutcome = GovernanceActionOutcome<"channel_ban_upserted", { channelId: string; uid: string; until: number }>;
/**
 * 解除频道封禁结果。
 */
export type RemoveChannelBanOutcome = GovernanceActionOutcome<"channel_ban_removed", { channelId: string; uid: string }>;
