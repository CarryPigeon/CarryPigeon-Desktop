/**
 * @fileoverview chat 治理运行时装配。
 * @description
 * 聚合 room-governance 子域所需的动作与成员侧栏刷新逻辑，避免主 store 持续膨胀。
 */

import { createChannelAdminActions, createChannelUserActions } from "@/features/chat/room-governance/internal";
import type { ChatMember } from "@/features/chat/room-governance/contracts";
import type { ChatApiGateway } from "./chatGateway";
import type { ChatRuntimeScopePort } from "./chatScopePort";
import type { ChatGovernanceRuntimePort, ChatGovernanceStateSlice } from "./chatGovernanceRuntimePorts";

export type ChatGovernanceRuntimeDeps = {
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
  // room-governance 只通过窄目录端口表达同步意图，不直接持有 session 容器。
  const channelCatalog = {
    setJoinRequested(channelId: string, joinRequested: boolean): void {
      const channel = channelsRef.value.find((item) => item.id === channelId);
      if (channel) channel.joinRequested = joinRequested;
    },
    applyChannelPatch(channelId: string, patch: { name?: string; brief?: string }): void {
      const channel = channelsRef.value.find((item) => item.id === channelId);
      if (!channel) return;
      if (typeof patch.name === "string" && patch.name.trim()) channel.name = patch.name.trim();
      if (typeof patch.brief === "string") channel.brief = patch.brief;
    },
    reconcileSelectionAfterDeletion(deletedChannelId: string): void {
      if (currentChannelId.value !== deletedChannelId) return;
      currentChannelId.value = channelsRef.value[0]?.id ?? "";
    },
  };

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
      members.value = nextMembers;
    } catch {
      if (scope.getActiveServerSocket() !== requestSocket) return;
      if (scopeVersion.value !== requestScopeVersion) return;
      if (currentChannelId.value.trim() !== channelId) return;
      members.value = [];
    }
  }

  return {
    refreshChannels,
    refreshMembersRail,
    ...adminActions,
    ...userActions,
  };
}
