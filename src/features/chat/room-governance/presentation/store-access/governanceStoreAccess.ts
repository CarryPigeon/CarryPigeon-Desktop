/**
 * @fileoverview room-governance presentation store access。
 * @description
 * 这是 room-governance presentation/runtime 内部使用的 store 访问面。
 * 它只转发 runtime 管理的当前子域 store，不暴露聚合 store 或内部运行时实现。
 */

import { computed } from "vue";
import { getRoomGovernanceStore } from "@/features/chat/application/runtime/runtimeAccess";
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

export const members = computed(() => resolveRoomGovernanceStore().members.value);

export function applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
  return resolveRoomGovernanceStore().applyJoin(channelId);
}

export function createChannel(name: string, brief?: string): Promise<CreateChannelOutcome> {
  return resolveRoomGovernanceStore().createChannel(name, brief);
}

export function deleteChannel(channelId: string): Promise<DeleteChannelOutcome> {
  return resolveRoomGovernanceStore().deleteChannel(channelId);
}

export function kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome> {
  return resolveRoomGovernanceStore().kickMember(channelId, uid);
}

export function listApplications(channelId: string): Promise<ChannelApplication[]> {
  return resolveRoomGovernanceStore().listApplications(channelId);
}

export function decideApplication(
  channelId: string,
  applicationId: string,
  approved: boolean,
): Promise<DecideChannelApplicationOutcome> {
  return resolveRoomGovernanceStore().decideApplication(channelId, applicationId, approved);
}

export function listBans(channelId: string): Promise<ChannelBan[]> {
  return resolveRoomGovernanceStore().listBans(channelId);
}

export function listMembers(channelId: string): Promise<ChannelMember[]> {
  return resolveRoomGovernanceStore().listMembers(channelId);
}

export function removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome> {
  return resolveRoomGovernanceStore().removeAdmin(channelId, uid);
}

export function removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome> {
  return resolveRoomGovernanceStore().removeBan(channelId, uid);
}

export function setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome> {
  return resolveRoomGovernanceStore().setAdmin(channelId, uid);
}

export function setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
  return resolveRoomGovernanceStore().setBan(channelId, uid, until, reason);
}

export function updateChannelMeta(channelId: string, patch: { name?: string; brief?: string }): Promise<UpdateChannelMetaOutcome> {
  return resolveRoomGovernanceStore().updateChannelMeta(channelId, patch);
}

export type { ChannelApplication, ChannelBan, ChannelMember, GovernanceChannelSummary };
