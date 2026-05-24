/**
 * @fileoverview room-governance announcement type checks。
 * @description
 * 编译期验证公告相关类型与 capability 是否满足跨子域契约。
 */

import type { ChatChannelAnnouncementRecord } from "@/features/chat/domain/types/chatApiModels";
import type { RoomGovernanceCapabilities } from "@/features/chat/room-governance/api-types";

const announcement: ChatChannelAnnouncementRecord = { content: "Welcome", updatedAt: 1, updatedBy: "u1" };

async function acceptsGovernance(capabilities: RoomGovernanceCapabilities): Promise<void> {
  const outcome = await capabilities.forChannel("c1").updateAnnouncement("Updated");
  if (outcome.ok) {
    outcome.channelId satisfies string;
  }
}

void announcement;
void acceptsGovernance;
