/**
 * @fileoverview chat governance runtime contracts
 * @description
 * 定义 room-governance runtime 的状态切片与对外契约。
 */

import type { createChatStoreState } from "@/features/chat/presentation/store/live/chatStoreState";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GrantChannelAdminOutcome,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/api-types";
import type { ChatChannel } from "@/features/chat/room-session/api-types";

type ChatStoreState = ReturnType<typeof createChatStoreState>;

export type ChatGovernanceStateSlice = Pick<
  ChatStoreState,
  "channelsRef" | "currentChannelId" | "members" | "scopeVersion"
>;

export type ChatGovernanceRuntimePort = {
  refreshChannels(): Promise<void>;
  refreshMembersRail(channelId: string): Promise<void>;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  updateChannelMeta(channelId: string, patch: Partial<Pick<ChatChannel, "name" | "brief">>): Promise<UpdateChannelMetaOutcome>;
  listMembers(channelId: string): Promise<ChannelMember[]>;
  kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome>;
  setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome>;
  removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome>;
  listApplications(channelId: string): Promise<ChannelApplication[]>;
  decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<DecideChannelApplicationOutcome>;
  listBans(channelId: string): Promise<ChannelBan[]>;
  setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome>;
  removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome>;
  createChannel(name: string, brief?: string): Promise<CreateChannelOutcome>;
  deleteChannel(channelId: string): Promise<DeleteChannelOutcome>;
};
