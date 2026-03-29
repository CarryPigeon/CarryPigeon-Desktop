/**
 * @fileoverview room-governance 应用层输出端口。
 * @description chat/room-governance｜application：面向治理用例编排的最小依赖集合。
 */

import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { GovernanceChannelSummary } from "@/features/chat/room-governance/contracts";

/**
 * room-governance 应用层所需的最小 API 能力。
 */
export type GovernanceApiPort = Pick<
  ChatApiPort,
  | "applyJoinChannel"
  | "patchChannel"
  | "listChannelMembers"
  | "kickChannelMember"
  | "addChannelAdmin"
  | "removeChannelAdmin"
  | "listChannelApplications"
  | "decideChannelApplication"
  | "listChannelBans"
  | "putChannelBan"
  | "deleteChannelBan"
  | "createChannel"
  | "deleteChannel"
>;

/**
 * room-governance 对频道目录的最小写入端口。
 *
 * 说明：
 * - 治理用例不直接持有 session 的 refs/reactive 容器；
 * - 只通过该端口表达对频道目录的最小同步意图。
 */
export type GovernanceChannelCatalogPort = {
  setJoinRequested(channelId: string, joinRequested: boolean): void;
  applyChannelPatch(channelId: string, patch: Partial<Pick<GovernanceChannelSummary, "name" | "brief">>): void;
  reconcileSelectionAfterDeletion(deletedChannelId: string): void;
};
