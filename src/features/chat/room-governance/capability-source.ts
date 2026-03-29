/**
 * @fileoverview room-governance capability source
 * @description
 * 组装 room-governance 子域的内部 capability 来源。
 *
 * 说明：
 * - `api.ts` 只负责对外导出和单例访问；
 * - 本文件负责把 runtime store-access 适配成治理子域 capability。
 */

import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
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
} from "./presentation/store-access/governanceStoreAccess";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelGovernanceCapabilities,
  ChannelMember,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  RoomGovernanceCapabilities,
  RoomGovernanceMembersSnapshot,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "./api-types";

function getMembersSnapshot(): RoomGovernanceMembersSnapshot {
  return clonePlainData(members.value);
}

const observeMembersSnapshot = createWatchedSnapshotObserver(getMembersSnapshot);

/**
 * 创建 room-governance 子域内部 capability 源。
 */
export function createRoomGovernanceCapabilitySource(): RoomGovernanceCapabilities {
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
        applyJoin(): Promise<ApplyJoinChannelOutcome> {
          return applyJoin(channelId);
        },
        updateMeta(patch: { name?: string; brief?: string }): Promise<UpdateChannelMetaOutcome> {
          return updateChannelMeta(channelId, patch);
        },
        deleteChannel(): Promise<DeleteChannelOutcome> {
          return deleteChannel(channelId);
        },
        listMembers(): Promise<ChannelMember[]> {
          return listMembers(channelId);
        },
        kickMember(uid: string): Promise<KickChannelMemberOutcome> {
          return kickMember(channelId, uid);
        },
        setAdmin(uid: string): Promise<GrantChannelAdminOutcome> {
          return setAdmin(channelId, uid);
        },
        removeAdmin(uid: string): Promise<RevokeChannelAdminOutcome> {
          return removeAdmin(channelId, uid);
        },
        listApplications(): Promise<ChannelApplication[]> {
          return listApplications(channelId);
        },
        decideApplication(
          applicationId: string,
          approved: boolean,
        ): Promise<DecideChannelApplicationOutcome> {
          return decideApplication(channelId, applicationId, approved);
        },
        listBans(): Promise<ChannelBan[]> {
          return listBans(channelId);
        },
        setBan(uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
          return setBan(channelId, uid, until, reason);
        },
        removeBan(uid: string): Promise<RemoveChannelBanOutcome> {
          return removeBan(channelId, uid);
        },
      };
    },
  };
}
