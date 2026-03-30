/**
 * @fileoverview room-governance presentation store access。
 * @description
 * 这是 room-governance presentation/runtime 内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getRoomGovernanceStore } from "@/features/chat/composition/runtimeAccess";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GrantChannelAdminOutcome,
  GovernanceChannelSummary,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/api-types";

/**
 * 延迟解析当前 room-governance store，避免 import 时绑定到过期 runtime。
 */
function resolveRoomGovernanceStore(): ReturnType<typeof getRoomGovernanceStore> {
  return getRoomGovernanceStore();
}

/**
 * 当前频道成员侧栏只读投影。
 */
export const members = computed(() => resolveRoomGovernanceStore().members.value);

/**
 * 对指定频道发起加入申请。
 */
export function applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
  return resolveRoomGovernanceStore().applyJoin(channelId);
}

/**
 * 创建频道。
 */
export function createChannel(name: string, brief?: string): Promise<CreateChannelOutcome> {
  return resolveRoomGovernanceStore().createChannel(name, brief);
}

/**
 * 删除频道。
 */
export function deleteChannel(channelId: string): Promise<DeleteChannelOutcome> {
  return resolveRoomGovernanceStore().deleteChannel(channelId);
}

/**
 * 将某个成员移出频道。
 */
export function kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome> {
  return resolveRoomGovernanceStore().kickMember(channelId, uid);
}

/**
 * 查询频道申请列表。
 */
export function listApplications(channelId: string): Promise<ChannelApplication[]> {
  return resolveRoomGovernanceStore().listApplications(channelId);
}

/**
 * 审批一条加入申请。
 */
export function decideApplication(
  channelId: string,
  applicationId: string,
  approved: boolean,
): Promise<DecideChannelApplicationOutcome> {
  return resolveRoomGovernanceStore().decideApplication(channelId, applicationId, approved);
}

/**
 * 查询频道封禁列表。
 */
export function listBans(channelId: string): Promise<ChannelBan[]> {
  return resolveRoomGovernanceStore().listBans(channelId);
}

/**
 * 查询频道成员列表。
 */
export function listMembers(channelId: string): Promise<ChannelMember[]> {
  return resolveRoomGovernanceStore().listMembers(channelId);
}

/**
 * 撤销管理员。
 */
export function removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome> {
  return resolveRoomGovernanceStore().removeAdmin(channelId, uid);
}

/**
 * 移除封禁记录。
 */
export function removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome> {
  return resolveRoomGovernanceStore().removeBan(channelId, uid);
}

/**
 * 设为管理员。
 */
export function setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome> {
  return resolveRoomGovernanceStore().setAdmin(channelId, uid);
}

/**
 * 设置封禁。
 */
export function setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
  return resolveRoomGovernanceStore().setBan(channelId, uid, until, reason);
}

/**
 * 更新频道名称或简介。
 */
export function updateChannelMeta(channelId: string, patch: { name?: string; brief?: string }): Promise<UpdateChannelMetaOutcome> {
  return resolveRoomGovernanceStore().updateChannelMeta(channelId, patch);
}

export type { ChannelApplication, ChannelBan, ChannelMember, GovernanceChannelSummary };
