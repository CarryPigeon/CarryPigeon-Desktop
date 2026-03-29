/**
 * @fileoverview chat 治理运行时装配。
 * @description
 * 聚合 room-governance 子域所需的动作与成员侧栏刷新逻辑，避免主 store 持续膨胀。
 */

import { createChannelAdminActions, createChannelUserActions } from "@/features/chat/room-governance/internal";
import type { ChatMember } from "@/features/chat/room-governance/api-types";
import type { ChatApiGateway } from "@/features/chat/presentation/store/live/chatGateway";
import type { ChatRuntimeScopePort } from "@/features/chat/presentation/store/live/chatScopePort";
import type { ChatGovernanceRuntimePort, ChatGovernanceStateSlice } from "./governanceRuntimePorts";
import {
  createGovernanceChannelCatalogPort,
  createGovernanceMembersRailStatePort,
} from "./governanceStatePorts";

export type ChatGovernanceRuntimeDeps = {
  /**
   * 该依赖集合对应 governance 的两类工作：
   * - 命令执行（普通成员动作 / 管理员动作）
   * - 当前频道成员侧栏同步
   */
  api: ChatApiGateway;
  channelsRef: ChatGovernanceStateSlice["channelsRef"];
  currentChannelId: ChatGovernanceStateSlice["currentChannelId"];
  members: ChatGovernanceStateSlice["members"];
  scopeVersion: ChatGovernanceStateSlice["scopeVersion"];
  refreshChannels: () => Promise<void>;
  scope: ChatRuntimeScopePort;
};

export function createChatGovernanceRuntime(
  deps: ChatGovernanceRuntimeDeps,
): ChatGovernanceRuntimePort {
  const {
    api,
    channelsRef,
    currentChannelId,
    members,
    scopeVersion,
    refreshChannels,
    scope,
  } = deps;
  const channelCatalog = createGovernanceChannelCatalogPort({
    channelsRef,
    currentChannelId,
  });
  const membersRailState = createGovernanceMembersRailStatePort({
    members,
  });

  const adminActions = createChannelAdminActions({
    api,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    refreshChannels,
    channelCatalog,
  });

  const userActions = createChannelUserActions({
    api,
    getSocketAndValidToken: scope.getSocketAndValidToken,
    getActiveServerSocket: scope.getActiveServerSocket,
    getActiveScopeVersion: scope.getActiveScopeVersion,
    refreshChannels,
    channelCatalog,
  });

  /**
   * 刷新当前频道的成员侧栏。
   *
   * 它属于 governance runtime 而不是 room-session：
   * - 成员数据的读取和解释是治理语义；
   * - session 只需要知道“当前频道切换后要不要触发一次 members rail refresh”。
   */
  async function refreshMembersRail(cid: string): Promise<void> {
    const channelId = String(cid).trim();
    if (!channelId) return;
    const requestSocket = scope.getActiveServerSocket();
    const requestScopeVersion = scopeVersion.value;
    try {
      const list = await adminActions.listMembers(channelId);
      if (scope.getActiveServerSocket() !== requestSocket) return;
      if (scopeVersion.value !== requestScopeVersion) return;
      if (currentChannelId.value.trim() !== channelId) return;
      const nextMembers: ChatMember[] = [];
      for (const member of list) {
        const role =
          member.role === "owner" || member.role === "admin" ? (member.role as "owner" | "admin") : "member";
        nextMembers.push({
          id: member.uid,
          name: member.nickname || `u:${String(member.uid).slice(-6)}`,
          role,
        });
      }
      membersRailState.replaceMembers(nextMembers);
    } catch {
      if (scope.getActiveServerSocket() !== requestSocket) return;
      if (scopeVersion.value !== requestScopeVersion) return;
      if (currentChannelId.value.trim() !== channelId) return;
      membersRailState.clearMembers();
    }
  }

  return {
    refreshChannels,
    refreshMembersRail,
    ...adminActions,
    ...userActions,
  };
}
