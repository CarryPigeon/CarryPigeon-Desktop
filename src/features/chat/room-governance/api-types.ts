/**
 * @fileoverview chat/room-governance 公共类型入口。
 * @description
 * 统一承载 room-governance 子域的稳定公共契约，避免治理页面把 `api.ts`
 * 与 `domain/contracts.ts` 混合作为类型源。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  ChatMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "./domain/contracts";

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
  GovernanceChannelSummary,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "./domain/contracts";

export type RoomGovernanceMembersSnapshot = readonly ChatMember[];

export type RoomGovernanceMembersCapabilities = ReadableCapability<RoomGovernanceMembersSnapshot>;

export type ChannelGovernanceCapabilities = {
  applyJoin(): Promise<ApplyJoinChannelOutcome>;
  updateMeta(patch: { name?: string; brief?: string }): Promise<UpdateChannelMetaOutcome>;
  deleteChannel(): Promise<DeleteChannelOutcome>;
  listMembers(): Promise<ChannelMember[]>;
  kickMember(uid: string): Promise<KickChannelMemberOutcome>;
  setAdmin(uid: string): Promise<GrantChannelAdminOutcome>;
  removeAdmin(uid: string): Promise<RevokeChannelAdminOutcome>;
  listApplications(): Promise<ChannelApplication[]>;
  decideApplication(applicationId: string, approved: boolean): Promise<DecideChannelApplicationOutcome>;
  listBans(): Promise<ChannelBan[]>;
  setBan(uid: string, until: number, reason: string): Promise<SetChannelBanOutcome>;
  removeBan(uid: string): Promise<RemoveChannelBanOutcome>;
};

export type CurrentChannelGovernanceCapabilities = {
  members: RoomGovernanceMembersCapabilities;
};

export type RoomGovernanceCapabilities = {
  currentChannel: CurrentChannelGovernanceCapabilities;
  createChannel(name: string, brief?: string): Promise<CreateChannelOutcome>;
  forChannel(channelId: string): ChannelGovernanceCapabilities;
};
