/**
 * @fileoverview chat Feature 公共类型出口。
 * @description
 * 仅导出 chat 对外稳定可见的公共契约，避免把内部聚合/运行时实现或 Vue 视图对象暴露为公共 API。
 */

import type { ReadableCapability } from "@/shared/types/capabilities";

export type {
  ChatChannel,
  ChannelSelectionErrorInfo,
  ChannelSelectionOutcome,
} from "./room-session/contracts";
export type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  MessageDomain,
  SendChatMessageOutcome,
} from "./message-flow/contracts";
export type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  ChatMember,
  CreateChannelOutcome,
  DecideChannelApplicationOutcome,
  DeleteChannelOutcome,
  GovernanceCommandErrorInfo,
  GrantChannelAdminOutcome,
  GovernanceChannelSummary,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
} from "./room-governance/contracts";

export type ChatSessionDirectorySnapshot = {
  allChannels: readonly import("./room-session/contracts").ChatChannel[];
  visibleChannels: readonly import("./room-session/contracts").ChatChannel[];
  searchQuery: string;
  activeTab: "joined" | "discover";
};

export type ChatCurrentChannelSessionSnapshot = {
  currentChannelId: string;
  lastReadMessageId: string;
  lastReadTimeMs: number;
};

export type ChatCurrentChannelMessageTimelineSnapshot = {
  currentMessages: readonly import("./message-flow/contracts").ChatMessage[];
  currentMessageCount: number;
  hasMoreHistory: boolean;
  isLoadingHistory: boolean;
};

export type ChatMessageComposerSnapshot = {
  draft: string;
  activeDomainId: string;
  replyToMessageId: string;
  actionError: import("./message-flow/contracts").ChatMessageActionErrorInfo | null;
  availableDomains: readonly import("./message-flow/contracts").MessageDomain[];
};

export type ChatSessionDirectoryCapabilities = ReadableCapability<ChatSessionDirectorySnapshot> & {
  /**
   * 更新频道目录搜索关键字。
   *
   * @param value - 目录筛选输入值。
   */
  setSearchQuery(value: string): void;

  /**
   * 切换目录当前显示的频道分组。
   *
   * @param value - 目标目录分组。
   */
  setActiveTab(value: "joined" | "discover"): void;

  /**
   * 将目录切到 discover 视图并聚焦某个频道名称。
   *
   * 适用场景：
   * - 从 quick switcher 跳转到频道发现结果；
   * - 需要在目录中高亮一个未加入频道。
   *
   * @param channelName - 需要聚焦的频道名称。
   */
  focusDiscoverChannel(channelName: string): void;

  /**
   * 从当前目录快照中查询频道资料。
   *
   * @param channelId - 目标频道 id。
   * @returns 命中时返回频道快照；否则返回 `null`。
   */
  findChannelById(channelId: string): import("./room-session/contracts").ChatChannel | null;
};

export type ChatCurrentChannelSessionCapabilities = ReadableCapability<ChatCurrentChannelSessionSnapshot> & {
  /**
   * 确保 chat 当前会话已完成基础就绪。
   *
   * 适用场景：
   * - 进入 chat 工作区；
   * - workspace/server 切换后重新装配当前 runtime。
   */
  ensureReady(): Promise<void>;

  /**
   * 将当前会话切换到指定频道。
   *
   * @param channelId - 目标频道 id。
   */
  selectChannel(channelId: string): Promise<import("./room-session/contracts").ChannelSelectionOutcome>;

  /**
   * 上报当前频道已读状态。
   *
   * 常见触发：
   * - 面板滚动到底部；
   * - 页面重新聚焦；
   * - 新消息已被用户可见。
   */
  reportReadState(): Promise<void>;
};

export type ChatSessionCapabilities = {
  /**
   * 频道目录能力。
   *
   * 说明：
   * - 负责列表筛选、discover 聚焦和目录级查询；
   * - 不处理消息时间线或治理动作。
   */
  directory: ChatSessionDirectoryCapabilities;

  /**
   * 当前频道会话能力。
   *
   * 说明：
   * - 负责当前频道选择、读状态上报和就绪编排；
   * - 所有动作都显式绑定“当前会话”上下文。
   */
  currentChannel: ChatCurrentChannelSessionCapabilities;
};

export type ChatCurrentChannelMessageFlowCapabilities = ReadableCapability<ChatCurrentChannelMessageTimelineSnapshot> & {
  /**
   * 在当前频道时间线中按消息 id 查询消息。
   *
   * @param messageId - 目标消息 id。
   * @returns 命中时返回消息快照；否则返回 `null`。
   */
  findMessageById(messageId: string): import("./message-flow/contracts").ChatMessage | null;

  /**
   * 继续加载当前频道更早的历史消息。
   */
  loadMoreHistory(): Promise<void>;

  /**
   * 将 composer 绑定到“回复某条消息”的状态。
   *
   * @param messageId - 被回复消息 id。
   */
  beginReply(messageId: string): void;

  /**
   * 删除当前频道中的指定消息。
   *
   * @param messageId - 目标消息 id。
   */
  deleteMessage(messageId: string): Promise<import("./message-flow/contracts").DeleteChatMessageOutcome>;
};

export type ChatChannelMessageLookupCapabilities = {
  /**
   * 在已绑定频道上下文中按 id 查询消息。
   *
   * @param messageId - 目标消息 id。
   * @returns 命中时返回消息快照；否则返回 `null`。
   */
  findMessageById(messageId: string): import("./message-flow/contracts").ChatMessage | null;
};

export type ChatMessageComposerCapabilities = ReadableCapability<ChatMessageComposerSnapshot> & {
  /**
   * 更新当前 composer 草稿。
   *
   * @param value - 新草稿内容。
   */
  setDraft(value: string): void;

  /**
   * 切换当前 composer 所选的消息 domain。
   *
   * @param value - 目标 domain id。
   */
  setActiveDomainId(value: string): void;

  /**
   * 设置发送动作错误文案。
   *
   * 说明：
   * - 主要用于 presentation 将异步失败投影到 UI；
   * - 不应用作长期业务状态。
   *
   * @param value - 错误文案。
   */
  setActionError(value: import("./message-flow/contracts").ChatMessageActionErrorInfo | null): void;

  /**
   * 将文件分享键以标准占位格式追加到草稿末尾。
   *
   * @param shareKey - 上传后可复用的分享键。
   */
  appendAttachmentShareKey(shareKey: string): void;

  /**
   * 清除当前回复状态。
   */
  cancelReply(): void;

  /**
   * 发送当前 composer 内容或显式指定的提交载荷。
   *
   * @param payload - 可选的显式发送载荷；为空时使用当前 composer 状态。
   */
  sendMessage(payload?: import("./message-flow/contracts").ComposerSubmitPayload): Promise<import("./message-flow/contracts").SendChatMessageOutcome>;
};

export type ChatMessageFlowCapabilities = {
  /**
   * 当前频道消息流能力。
   *
   * 说明：
   * - 负责当前频道时间线读取、分页、回复与删除；
   * - 所有动作都绑定当前已选频道，不再重复携带 `channelId` 参数。
   */
  currentChannel: ChatCurrentChannelMessageFlowCapabilities;

  /**
   * 当前 composer 能力。
   *
   * 说明：
   * - 负责草稿、domain、回复状态与发送；
   * - 不暴露页面级 view model。
   */
  composer: ChatMessageComposerCapabilities;

  /**
   * 绑定到某个指定频道的只读消息查询 capability。
   *
   * 适用场景：
   * - 渲染跨消息引用；
   * - 在非当前频道上下文读取一条已缓存消息。
   *
   * @param channelId - 目标频道 id。
   * @returns 绑定后的频道消息读取 capability。
   */
  forChannel(channelId: string): ChatChannelMessageLookupCapabilities;
};

export type ChatCurrentChannelGovernanceCapabilities = {
  /**
   * 当前频道成员快照 capability。
   *
   * 说明：
   * - 用于 members rail 之类依赖“当前频道成员投影”的读取场景；
   * - 不承载跨频道治理动作。
   */
  members: ReadableCapability<readonly import("./room-governance/contracts").ChatMember[]>;
};

export type ChatChannelGovernanceCapabilities = {
  /**
   * 对已绑定频道发起加入或申请加入动作。
   */
  applyJoin(): Promise<import("./room-governance/contracts").ApplyJoinChannelOutcome>;

  /**
   * 更新已绑定频道的基础资料。
   *
   * @param patch - 可更新的频道元信息 patch。
   */
  updateMeta(patch: { name?: string; brief?: string }): Promise<import("./room-governance/contracts").UpdateChannelMetaOutcome>;

  /**
   * 删除已绑定频道。
   */
  deleteChannel(): Promise<import("./room-governance/contracts").DeleteChannelOutcome>;

  /**
   * 读取已绑定频道的成员列表。
   */
  listMembers(): Promise<import("./room-governance/contracts").ChannelMember[]>;

  /**
   * 将某个成员移出已绑定频道。
   *
   * @param uid - 目标用户 id。
   */
  kickMember(uid: string): Promise<import("./room-governance/contracts").KickChannelMemberOutcome>;

  /**
   * 授予已绑定频道中的某位成员管理员权限。
   *
   * @param uid - 目标用户 id。
   */
  setAdmin(uid: string): Promise<import("./room-governance/contracts").GrantChannelAdminOutcome>;

  /**
   * 撤销已绑定频道中的管理员权限。
   *
   * @param uid - 目标用户 id。
   */
  removeAdmin(uid: string): Promise<import("./room-governance/contracts").RevokeChannelAdminOutcome>;

  /**
   * 读取已绑定频道的入群申请列表。
   */
  listApplications(): Promise<import("./room-governance/contracts").ChannelApplication[]>;

  /**
   * 审批已绑定频道中的某条入群申请。
   *
   * @param applicationId - 申请记录 id。
   * @param approved - 是否通过审批。
   */
  decideApplication(
    applicationId: string,
    approved: boolean,
  ): Promise<import("./room-governance/contracts").DecideChannelApplicationOutcome>;

  /**
   * 读取已绑定频道的封禁列表。
   */
  listBans(): Promise<import("./room-governance/contracts").ChannelBan[]>;

  /**
   * 为已绑定频道新增或更新封禁。
   *
   * @param uid - 被封禁用户 id。
   * @param until - 解封时间戳；`0` 表示永久封禁。
   * @param reason - 封禁原因。
   */
  setBan(uid: string, until: number, reason: string): Promise<import("./room-governance/contracts").SetChannelBanOutcome>;

  /**
   * 解除已绑定频道中的某个封禁。
   *
   * @param uid - 目标用户 id。
   */
  removeBan(uid: string): Promise<import("./room-governance/contracts").RemoveChannelBanOutcome>;
};

export type ChatGovernanceCapabilities = {
  /**
   * 当前频道治理读取能力。
   */
  currentChannel: ChatCurrentChannelGovernanceCapabilities;

  /**
   * 创建新频道。
   *
   * @param name - 新频道名称。
   * @param brief - 频道简介，可选。
   * @returns 新建后的频道摘要。
   */
  createChannel(name: string, brief?: string): Promise<import("./room-governance/contracts").CreateChannelOutcome>;

  /**
   * 绑定到某个指定频道的治理 capability。
   *
   * 说明：
   * - 绑定后，后续动作不再重复接受 `channelId`；
   * - 调用者可将频道上下文显式保存在局部变量中，减轻 API 噪音。
   *
   * @param channelId - 目标频道 id。
   * @returns 已绑定频道上下文的治理 capability。
   */
  forChannel(channelId: string): ChatChannelGovernanceCapabilities;
};

export type ChatCapabilities = {
  /**
   * chat 会话能力分组。
   */
  session: ChatSessionCapabilities;

  /**
   * chat 消息流能力分组。
   */
  messageFlow: ChatMessageFlowCapabilities;

  /**
   * chat 治理能力分组。
   */
  governance: ChatGovernanceCapabilities;
};
