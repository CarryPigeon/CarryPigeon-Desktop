/**
 * @fileoverview room-session 领域契约。
 * @description
 * 由 room-session 子域持有的稳定公共频道模型。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";

/**
 * 频道条目（room-session 对外名称）。
 *
 * room-session 不重新发明频道结构，而是复用中立的 `ChannelSummary`，
 * 这样频道目录与治理子域可以共享同一份基础语义。
 */
export type ChatChannel = ChannelSummary;

export type ChannelSelectionErrorCode =
  | "missing_channel_id"
  | "channel_not_found"
  | "select_channel_failed";

/**
 * 频道切换失败时的稳定错误代数。
 */
export type ChannelSelectionErrorInfo = SemanticErrorInfo<ChannelSelectionErrorCode>;

/**
 * 频道切换显式结果。
 *
 * 说明：
 * - 成功时只返回 `channelId`，因为频道详情本身已由 room-session 状态维护；
 * - 失败时返回稳定错误码，而不是依赖异常字符串。
 */
export type ChannelSelectionOutcome =
  | SuccessOutcome<"chat_channel_selected", { channelId: string }>
  | FailureOutcome<"chat_channel_selection_rejected", ChannelSelectionErrorCode>;
