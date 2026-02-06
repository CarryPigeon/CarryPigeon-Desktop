/**
 * @fileoverview Patchbay 聊天展示层类型定义。
 * @description chat｜展示层状态（store）：chatStoreTypes。
 * 该文件仅包含展示层（presentation）会直接消费的类型：
 * - Store 暴露给页面/组件的状态结构
 * - 组件渲染需要的消息/频道/成员模型
 *
 * 约定：
 * - 注释统一使用中文
 * - 日志输出统一使用英文（由调用方 logger 控制）
 */

import type { Ref } from "vue";

/**
 * 频道条目（展示层模型）。
 */
export type ChatChannel = {
  id: string;
  name: string;
  unread: number;
  brief: string;
  joined: boolean;
  joinRequested: boolean;
};

/**
 * 频道成员（轻量展示）。
 */
export type ChatMember = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
};

/**
 * 频道成员（管理页模型）。
 */
export type ChannelMember = {
  uid: string;
  nickname: string;
  avatar?: string;
  role: "owner" | "admin" | "member" | string;
  joinTime: number;
};

/**
 * 入群申请条目（管理页模型）。
 */
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

/**
 * 封禁条目（管理页模型）。
 */
export type ChannelBan = {
  cid: string;
  uid: string;
  nickname?: string;
  avatar?: string;
  until: number;
  reason: string;
  createTime: number;
};

/**
 * 消息 domain 描述（用于渲染色条/插件提示等）。
 */
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

/**
 * 编辑器提交载荷（Core:Text 或插件 composer）。
 */
export type ComposerSubmitPayload = {
  domain: string;
  domain_version: string;
  data: unknown;
  reply_to_mid?: string;
};

/**
 * 聊天消息展示模型（支持 core 文本与 domain 消息）。
 */
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

/**
 * 聊天展示层 store 对外暴露的接口类型。
 *
 * 说明：
 * - 用于组件/页面做类型约束；
 * - 具体实现位于 `chatStore`（包含 socket scope、WS/HTTP 编排等）。
 */
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
