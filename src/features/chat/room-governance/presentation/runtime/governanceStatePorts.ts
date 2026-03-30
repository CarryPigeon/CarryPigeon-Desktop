/**
 * @fileoverview room-governance runtime state -> application port adapters
 * @description
 * 把 room-governance runtime 使用的 Vue/ref 状态容器适配为
 * application 层与 runtime 编排可消费的显式状态端口。
 */

import type { Ref } from "vue";
import type { GovernanceChannelCatalogPort } from "@/features/chat/room-governance/domain/ports";
import type { ChatMember } from "@/features/chat/room-governance/api-types";
import type { ChatChannel } from "@/features/chat/room-session/api-types";

/**
 * 创建治理频道目录端口所需的状态容器。
 */
export type CreateGovernanceChannelCatalogPortDeps = {
  channelsRef: Ref<ChatChannel[]>;
  currentChannelId: Ref<string>;
};

/**
 * 将治理相关频道目录状态适配为 application 端口。
 */
export function createGovernanceChannelCatalogPort(
  deps: CreateGovernanceChannelCatalogPortDeps,
): GovernanceChannelCatalogPort {
  return {
    setJoinRequested(channelId: string, joinRequested: boolean): void {
      const channel = deps.channelsRef.value.find((item) => item.id === channelId);
      if (channel) channel.joinRequested = joinRequested;
    },
    applyChannelPatch(channelId: string, patch: { name?: string; brief?: string }): void {
      const channel = deps.channelsRef.value.find((item) => item.id === channelId);
      if (!channel) return;
      if (typeof patch.name === "string" && patch.name.trim()) channel.name = patch.name.trim();
      if (typeof patch.brief === "string") channel.brief = patch.brief;
    },
    reconcileSelectionAfterDeletion(deletedChannelId: string): void {
      if (deps.currentChannelId.value !== deletedChannelId) return;
      deps.currentChannelId.value = deps.channelsRef.value[0]?.id ?? "";
    },
  };
}

/**
 * 治理成员侧栏局部状态端口。
 */
export type GovernanceMembersRailStatePort = {
  replaceMembers(members: readonly ChatMember[]): void;
  clearMembers(): void;
};

/**
 * 创建治理成员侧栏状态端口所需的状态容器。
 */
export type CreateGovernanceMembersRailStatePortDeps = {
  members: Ref<ChatMember[]>;
};

/**
 * 将成员侧栏状态适配为治理 runtime 可消费的局部端口。
 */
export function createGovernanceMembersRailStatePort(
  deps: CreateGovernanceMembersRailStatePortDeps,
): GovernanceMembersRailStatePort {
  return {
    replaceMembers(members: readonly ChatMember[]): void {
      deps.members.value = [...members];
    },
    clearMembers(): void {
      deps.members.value = [];
    },
  };
}
