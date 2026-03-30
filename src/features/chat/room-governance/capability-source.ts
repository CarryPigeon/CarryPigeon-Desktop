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

/**
 * 构造“当前频道成员侧栏”的只读快照。
 */
function getMembersSnapshot(): RoomGovernanceMembersSnapshot {
  return clonePlainData(members.value);
}

const observeMembersSnapshot = createWatchedSnapshotObserver(getMembersSnapshot);

/**
 * 创建 room-governance 子域内部 capability 源。
 *
 * 说明：
 * - 该 capability-source 负责把按频道治理动作包装成局部 capability；
 * - 调用方只需要关心 `forChannel(channelId)`，而不需要再手工传递 `channelId`。
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
        /**
         * 对当前绑定频道发起加入申请。
         */
        applyJoin(): Promise<ApplyJoinChannelOutcome> {
          return applyJoin(channelId);
        },
        /**
         * 更新当前绑定频道的元信息。
         */
        updateMeta(patch: { name?: string; brief?: string }): Promise<UpdateChannelMetaOutcome> {
          return updateChannelMeta(channelId, patch);
        },
        /**
         * 删除当前绑定频道。
         */
        deleteChannel(): Promise<DeleteChannelOutcome> {
          return deleteChannel(channelId);
        },
        /**
         * 查询当前绑定频道的成员列表。
         */
        listMembers(): Promise<ChannelMember[]> {
          return listMembers(channelId);
        },
        /**
         * 将某个成员移出当前绑定频道。
         */
        kickMember(uid: string): Promise<KickChannelMemberOutcome> {
          return kickMember(channelId, uid);
        },
        /**
         * 把某个成员设为管理员。
         */
        setAdmin(uid: string): Promise<GrantChannelAdminOutcome> {
          return setAdmin(channelId, uid);
        },
        /**
         * 撤销某个管理员。
         */
        removeAdmin(uid: string): Promise<RevokeChannelAdminOutcome> {
          return removeAdmin(channelId, uid);
        },
        /**
         * 查询当前绑定频道的申请列表。
         */
        listApplications(): Promise<ChannelApplication[]> {
          return listApplications(channelId);
        },
        /**
         * 审批一条申请。
         */
        decideApplication(
          applicationId: string,
          approved: boolean,
        ): Promise<DecideChannelApplicationOutcome> {
          return decideApplication(channelId, applicationId, approved);
        },
        /**
         * 查询当前绑定频道的封禁列表。
         */
        listBans(): Promise<ChannelBan[]> {
          return listBans(channelId);
        },
        /**
         * 对当前绑定频道设置封禁。
         */
        setBan(uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
          return setBan(channelId, uid, until, reason);
        },
        /**
         * 对当前绑定频道移除封禁。
         */
        removeBan(uid: string): Promise<RemoveChannelBanOutcome> {
          return removeBan(channelId, uid);
        },
      };
    },
  };
}
