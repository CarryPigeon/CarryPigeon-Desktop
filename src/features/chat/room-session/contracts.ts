/**
 * @fileoverview room-session 展示契约。
 * @description
 * 由 room-session 子域持有的稳定公共频道模型。
 */

import type { FailureOutcome, SemanticErrorInfo, SuccessOutcome } from "@/shared/types/semantics";
import type { ChannelSummary } from "@/features/chat/contracts/channelSummary";

/**
 * 频道条目（room-session 对外名称）。
 */
export type ChatChannel = ChannelSummary;

export type ChannelSelectionErrorCode =
  | "missing_channel_id"
  | "channel_not_found"
  | "select_channel_failed";

export type ChannelSelectionErrorInfo = SemanticErrorInfo<ChannelSelectionErrorCode>;

export type ChannelSelectionOutcome =
  | SuccessOutcome<"chat_channel_selected", { channelId: string }>
  | FailureOutcome<"chat_channel_selection_rejected", ChannelSelectionErrorCode>;
