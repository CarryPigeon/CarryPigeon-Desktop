/**
 * @fileoverview chat governance state
 * @description
 * 承载 room-governance 维度的局部状态：成员侧栏缓存。
 */

import { ref } from "vue";
import type { ChatMember } from "@/features/chat/room-governance/contracts";

/**
 * 创建治理相关状态。
 *
 * @returns governance 状态。
 */
export function createChatGovernanceState() {
  const members = ref<ChatMember[]>([]);

  return {
    members,
  };
}
