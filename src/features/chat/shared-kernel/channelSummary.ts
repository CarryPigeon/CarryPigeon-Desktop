/**
 * @fileoverview chat 共享频道摘要契约。
 * @description
 * 定义 chat 子域间共享的最小频道摘要模型。
 */

import type { ChatChannelAnnouncementRecord } from "@/features/chat/domain/types/chatApiModels";

/**
 * 频道摘要（共享展示模型）。
 */
export type ChannelSummary = {
  id: string;
  name: string;
  unread: number;
  brief: string;
  joined: boolean;
  joinRequested: boolean;
  ownerUserId?: string;
  announcement?: ChatChannelAnnouncementRecord;
  categoryId?: string;
  categoryName?: string;
  order?: number;
};
