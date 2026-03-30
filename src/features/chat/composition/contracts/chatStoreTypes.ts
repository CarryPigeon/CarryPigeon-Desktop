/**
 * @fileoverview Patchbay chat 内部 runtime store 类型定义。
 * @description chat｜展示层状态（store）：chatStoreTypes。
 * 该文件只保留 chat 内部 runtime store 组合契约；
 * 各子域自己的公开模型仍分别定义在：
 * - `room-session/api-types.ts`
 * - `message-flow/api-types.ts`
 * - `room-governance/api-types.ts`
 *
 * 约定：
 * - 注释统一使用中文
 * - 日志输出统一使用英文（由调用方 logger 控制）
 */
import type { Ref } from "vue";
import type { ChatChannel, ChannelSelectionOutcome } from "@/features/chat/room-session/api-types";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/api-types";
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
  GovernanceChannelSummary,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "@/features/chat/room-governance/api-types";

/**
 * room-session 内部 runtime store。
 */
export type RoomSessionRuntimeStore = {
  channels: Readonly<Ref<ChatChannel[]>>;
  allChannels: Readonly<Ref<ChatChannel[]>>;
  channelSearch: Ref<string>;
  channelTab: Ref<"joined" | "discover">;
  currentChannelId: Ref<string>;
  currentChannelLastReadTimeMs: Readonly<Ref<number>>;
  currentChannelLastReadMid: Readonly<Ref<string>>;
  ensureChatReady(): Promise<void>;
  selectChannel(id: string): Promise<ChannelSelectionOutcome>;
  reportCurrentReadState(): Promise<void>;
};

/**
 * message-flow 内部 runtime store。
 */
export type MessageFlowRuntimeStore = {
  composerDraft: Ref<string>;
  selectedDomainId: Ref<string>;
  replyToMessageId: Ref<string>;
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
  currentMessages: Readonly<Ref<ChatMessage[]>>;
  currentChannelHasMore: Readonly<Ref<boolean>>;
  loadingMoreMessages: Readonly<Ref<boolean>>;
  availableDomains(): MessageDomain[];
  getMessageById(channelId: string, messageId: string): ChatMessage | null;
  loadMoreMessages(): Promise<void>;
  startReply(messageId: string): void;
  cancelReply(): void;
  deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome>;
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

/**
 * room-governance 内部 runtime store。
 */
export type RoomGovernanceRuntimeStore = {
  members: Readonly<Ref<ChatMember[]>>;
  applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome>;
  updateChannelMeta(channelId: string, patch: Partial<Pick<GovernanceChannelSummary, "name" | "brief">>): Promise<UpdateChannelMetaOutcome>;
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

/**
 * chat 聚合 runtime store。
 *
 * 说明：
 * - 这是 chat feature 内部使用的“完整聚合对象”；
 * - 不应被当作 presentation 或跨 feature 的推荐消费入口；
 * - 对外优先使用 subdomain slice / capability。
 */
export type ChatRuntimeAggregateStore =
  & RoomSessionRuntimeStore
  & MessageFlowRuntimeStore
  & RoomGovernanceRuntimeStore;

/**
 * chat 运行时切片：聚合 store + 各子域公开 store。
 */
export type ChatRuntime = {
  session: RoomSessionRuntimeStore;
  messageFlow: MessageFlowRuntimeStore;
  governance: RoomGovernanceRuntimeStore;
};
