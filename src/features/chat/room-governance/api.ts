/**
 * @fileoverview chat/room-governance 对外 API。
 * @description
 * 暴露频道治理能力（成员、申请、禁言、频道管理）。
 */

import { watch } from "vue";
import { clonePlainData } from "@/shared/utils/clonePlainData";
import {
  applyJoin,
  createChannel,
  decideApplication,
  deleteChannel,
  kickMember,
  listApplications,
  listBans,
  listMembers,
  members,
  removeAdmin,
  removeBan,
  setAdmin,
  setBan,
  updateChannelMeta,
} from "./application/governanceState";
export type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  ChatMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GovernanceCommandErrorCode,
  GovernanceCommandErrorInfo,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "./contracts";

export type RoomGovernanceMembersSnapshot = readonly import("./contracts").ChatMember[];

export type RoomGovernanceMembersCapabilities = {
  getSnapshot(): RoomGovernanceMembersSnapshot;
  observeSnapshot(observer: (snapshot: RoomGovernanceMembersSnapshot) => void): () => void;
};

export type ChannelGovernanceCapabilities = {
  applyJoin(): Promise<import("./contracts").ApplyJoinChannelOutcome>;
  updateMeta(patch: { name?: string; brief?: string }): Promise<import("./contracts").UpdateChannelMetaOutcome>;
  deleteChannel(): Promise<import("./contracts").DeleteChannelOutcome>;
  listMembers(): Promise<import("./contracts").ChannelMember[]>;
  kickMember(uid: string): Promise<import("./contracts").KickChannelMemberOutcome>;
  setAdmin(uid: string): Promise<import("./contracts").GrantChannelAdminOutcome>;
  removeAdmin(uid: string): Promise<import("./contracts").RevokeChannelAdminOutcome>;
  listApplications(): Promise<import("./contracts").ChannelApplication[]>;
  decideApplication(
    applicationId: string,
    approved: boolean,
  ): Promise<import("./contracts").DecideChannelApplicationOutcome>;
  listBans(): Promise<import("./contracts").ChannelBan[]>;
  setBan(uid: string, until: number, reason: string): Promise<import("./contracts").SetChannelBanOutcome>;
  removeBan(uid: string): Promise<import("./contracts").RemoveChannelBanOutcome>;
};

export type CurrentChannelGovernanceCapabilities = {
  members: RoomGovernanceMembersCapabilities;
};

export type RoomGovernanceCapabilities = {
  currentChannel: CurrentChannelGovernanceCapabilities;
  createChannel(name: string, brief?: string): Promise<import("./contracts").CreateChannelOutcome>;
  forChannel(channelId: string): ChannelGovernanceCapabilities;
};

/**
 * 创建 room-governance 子域能力对象。
 */
export function createRoomGovernanceCapabilities(): RoomGovernanceCapabilities {
  function getMembersSnapshot(): RoomGovernanceMembersSnapshot {
    return clonePlainData(members.value);
  }

  function observeMembersSnapshot(
    observer: (snapshot: RoomGovernanceMembersSnapshot) => void,
  ): () => void {
    return watch(getMembersSnapshot, observer, { immediate: true });
  }

  return {
    currentChannel: {
      members: {
        getSnapshot: getMembersSnapshot,
        observeSnapshot: observeMembersSnapshot,
      },
    },
    createChannel,
    forChannel(channelId: string): ChannelGovernanceCapabilities {
      return {
        applyJoin(): Promise<import("./contracts").ApplyJoinChannelOutcome> {
          return applyJoin(channelId);
        },
        updateMeta(patch: { name?: string; brief?: string }): Promise<import("./contracts").UpdateChannelMetaOutcome> {
          return updateChannelMeta(channelId, patch);
        },
        deleteChannel(): Promise<import("./contracts").DeleteChannelOutcome> {
          return deleteChannel(channelId);
        },
        listMembers(): Promise<import("./contracts").ChannelMember[]> {
          return listMembers(channelId);
        },
        kickMember(uid: string): Promise<import("./contracts").KickChannelMemberOutcome> {
          return kickMember(channelId, uid);
        },
        setAdmin(uid: string): Promise<import("./contracts").GrantChannelAdminOutcome> {
          return setAdmin(channelId, uid);
        },
        removeAdmin(uid: string): Promise<import("./contracts").RevokeChannelAdminOutcome> {
          return removeAdmin(channelId, uid);
        },
        listApplications(): Promise<import("./contracts").ChannelApplication[]> {
          return listApplications(channelId);
        },
        decideApplication(
          applicationId: string,
          approved: boolean,
        ): Promise<import("./contracts").DecideChannelApplicationOutcome> {
          return decideApplication(channelId, applicationId, approved);
        },
        listBans(): Promise<import("./contracts").ChannelBan[]> {
          return listBans(channelId);
        },
        setBan(uid: string, until: number, reason: string): Promise<import("./contracts").SetChannelBanOutcome> {
          return setBan(channelId, uid, until, reason);
        },
        removeBan(uid: string): Promise<import("./contracts").RemoveChannelBanOutcome> {
          return removeBan(channelId, uid);
        },
      };
    },
  };
}

let roomGovernanceCapabilitiesSingleton: RoomGovernanceCapabilities | null = null;

/**
 * 获取 room-governance 子域共享能力对象。
 */
export function getRoomGovernanceCapabilities(): RoomGovernanceCapabilities {
  roomGovernanceCapabilitiesSingleton ??= createRoomGovernanceCapabilities();
  return roomGovernanceCapabilitiesSingleton;
}
