/**
 * @fileoverview chatStoreTypes.ts
 * @description Presentation-layer types for the Patchbay chat store.
 */

import type { Ref } from "vue";

export type ChatChannel = {
  id: string;
  name: string;
  unread: number;
  brief: string;
  joined: boolean;
  joinRequested: boolean;
};

export type ChatMember = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

export type ChannelMember = {
  uid: string;
  nickname: string;
  avatar?: string;
  role: "owner" | "admin" | "member" | string;
  joinTime: number;
};

export type ChannelApplication = {
  applicationId: string;
  cid: string;
  uid: string;
  nickname?: string;
  avatar?: string;
  reason: string;
  applyTime: number;
  status: "pending" | "approved" | "rejected" | string;
};

export type ChannelBan = {
  cid: string;
  uid: string;
  nickname?: string;
  avatar?: string;
  until: number;
  reason: string;
  createTime: number;
};

export type MessageDomain = {
  id: string;
  label: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
  pluginIdHint?: string;
  version?: string;
};

export type ComposerSubmitPayload = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

export type ChatMessage =
  | {
      id: string;
      kind: "core_text";
      from: { id: string; name: string };
      timeMs: number;
      domain: MessageDomain;
      text: string;
      replyToId?: string;
    }
  | {
      id: string;
      kind: "domain_message";
      from: { id: string; name: string };
      timeMs: number;
      domain: MessageDomain;
      preview: string;
      data?: unknown;
      replyToId?: string;
    };

export type ChatStore = {
  channels: Readonly<Ref<ChatChannel[]>>;
  allChannels: Readonly<Ref<ChatChannel[]>>;
  channelSearch: Ref<string>;
  channelTab: Ref<"joined" | "discover">;
  composerDraft: Ref<string>;
  selectedDomainId: Ref<string>;
  replyToMessageId: Ref<string>;
  sendError: Ref<string>;
  currentChannelId: Ref<string>;
  currentMessages: Readonly<Ref<ChatMessage[]>>;
  currentChannelHasMore: Readonly<Ref<boolean>>;
  loadingMoreMessages: Readonly<Ref<boolean>>;
  currentChannelLastReadTimeMs: Readonly<Ref<number>>;
  members: Readonly<Ref<ChatMember[]>>;
  ensureChatReady(): Promise<void>;
  availableDomains(): MessageDomain[];
  getMessageById(channelId: string, messageId: string): ChatMessage | null;
  selectChannel(id: string): Promise<void>;
  reportCurrentReadState(): Promise<void>;
  loadMoreMessages(): Promise<void>;
  applyJoin(channelId: string): Promise<void>;
  updateChannelMeta(channelId: string, patch: Partial<Pick<ChatChannel, "name" | "brief">>): Promise<void>;
  startReply(messageId: string): void;
  cancelReply(): void;
  deleteMessage(messageId: string): Promise<void>;
  sendComposerMessage(payload?: ComposerSubmitPayload): Promise<void>;
  // Channel management
  listMembers(channelId: string): Promise<ChannelMember[]>;
  kickMember(channelId: string, uid: string): Promise<void>;
  setAdmin(channelId: string, uid: string): Promise<void>;
  removeAdmin(channelId: string, uid: string): Promise<void>;
  // Join applications
  listApplications(channelId: string): Promise<ChannelApplication[]>;
  decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void>;
  // Ban management
  listBans(channelId: string): Promise<ChannelBan[]>;
  setBan(channelId: string, uid: string, until: number, reason: string): Promise<void>;
  removeBan(channelId: string, uid: string): Promise<void>;
  // Channel CRUD
  createChannel(name: string, brief?: string): Promise<ChatChannel>;
  deleteChannel(channelId: string): Promise<void>;
};
