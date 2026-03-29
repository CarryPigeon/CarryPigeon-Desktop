/**
 * @fileoverview mockChatStore.ts
 * @description chat｜Mock 实现：mockChatStore（用于本地预览/测试）。
 */

import { computed, reactive, ref } from "vue";
import { currentChatUser, currentChatUsername } from "@/features/chat/integration/accountSession";
import { getAvailableChatMessageDomains } from "@/features/chat/integration/pluginRuntime";
import { chatCurrentServerSocket } from "@/features/chat/integration/serverWorkspace";
import type {
  ChatMessage,
  ChatMessageActionErrorInfo,
  MessageDomain,
  ComposerSubmitPayload,
  DeleteChatMessageOutcome,
  SendChatMessageOutcome,
} from "@/features/chat/message-flow/contracts";
import type { ChatChannel } from "@/features/chat/room-session/contracts";
import type { ChannelSelectionOutcome } from "@/features/chat/room-session/contracts";
import type {
  ApplyJoinChannelOutcome,
  ChannelApplication,
  ChannelBan,
  ChannelMember,
  ChatMember,
  CreateChannelOutcome,
  DeleteChannelOutcome,
  GovernanceCommandErrorCode,
  GovernanceCommandErrorInfo,
  GrantChannelAdminOutcome,
  GovernanceChannelSummary,
  KickChannelMemberOutcome,
  RemoveChannelBanOutcome,
  RevokeChannelAdminOutcome,
  SetChannelBanOutcome,
  UpdateChannelMetaOutcome,
  DecideChannelApplicationOutcome,
} from "@/features/chat/room-governance/contracts";
import type { ChatRuntimeStore } from "@/features/chat/presentation/store/chatStoreTypes";

/**
 * 创建 mock store 实现（纯内存）。
 *
 * @returns `ChatRuntimeStore`。
 */
export function createMockChatStore(): ChatRuntimeStore {
  function createGovernanceError(
    code: GovernanceCommandErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): GovernanceCommandErrorInfo {
    return {
      code,
      message,
      retryable: code === "governance_action_failed",
      details,
    };
  }

  const state = reactive({
    channels: [
      { id: "cid-ann", name: "Announcements", unread: 0, brief: "Patch notes and release signals.", joined: true, joinRequested: false },
      { id: "cid-prod", name: "General", unread: 3, brief: "Default channel for day-to-day chat.", joined: true, joinRequested: false },
      { id: "cid-tech", name: "Troubleshooting", unread: 0, brief: "Connectivity + diagnostics.", joined: true, joinRequested: false },
      { id: "cid-lab", name: "Lab", unread: 1, brief: "Experiments and extensions.", joined: false, joinRequested: false },
    ] as ChatChannel[],
    members: [
      { id: "u-1", name: "Operator", role: "owner" },
      { id: "u-2", name: "Relay", role: "admin" },
      { id: "u-3", name: "PatchCable", role: "member" },
      { id: "u-4", name: "Guest", role: "member" },
    ] as ChatMember[],
    messagesByChannel: {
      "cid-ann": [
        {
          id: "m-1",
          kind: "core_text",
          from: { id: "u-1", name: "Operator" },
          timeMs: Date.now() - 1000 * 60 * 30,
          domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
          text: "Welcome to Patchbay. This is the baseline text domain.",
        },
      ] as ChatMessage[],
      "cid-prod": [
        {
          id: "m-2",
          kind: "core_text",
          from: { id: "u-2", name: "Relay" },
          timeMs: Date.now() - 1000 * 60 * 18,
          domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
          text: "P0 checklist: required gate, unknown domain downgrade, hard delete disappears, weak disconnect hints.",
        },
        {
          id: "m-3",
          kind: "domain_message",
          from: { id: "u-4", name: "Guest" },
          timeMs: Date.now() - 1000 * 60 * 16,
          domain: { id: "Ext:Alpha", label: "Ext:Alpha", colorVar: "--cp-domain-ext-a", pluginIdHint: "ext.codec", version: "0.9.0" },
          preview: "UNPATCHED SIGNAL · Ext:Alpha@0.9.0 (install ext.codec to decode)",
        },
      ] as ChatMessage[],
      "cid-tech": [
        {
          id: "m-4",
          kind: "core_text",
          from: { id: "u-2", name: "Relay" },
          timeMs: Date.now() - 1000 * 60 * 10,
          domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
          text: "If you see TLS verify failures, you should be given certificate details and explicit trust choices.",
        },
      ] as ChatMessage[],
      "cid-lab": [
        {
          id: "m-5",
          kind: "domain_message",
          from: { id: "u-3", name: "PatchCable" },
          timeMs: Date.now() - 1000 * 60 * 5,
          domain: { id: "Ext:Beta", label: "Ext:Beta", colorVar: "--cp-domain-ext-b", pluginIdHint: "ext.styler", version: "0.3.2" },
          preview: "UNPATCHED SIGNAL · Ext:Beta@0.3.2",
        },
      ] as ChatMessage[],
    } as Record<string, ChatMessage[]>,
    lastReadTimeMsByChannel: {
      "cid-ann": Date.now(),
      "cid-prod": Date.now() - 1000 * 60 * 60,
      "cid-tech": Date.now(),
      "cid-lab": Date.now() - 1000 * 60 * 60,
    } as Record<string, number>,
    lastReadMidByChannel: {
      "cid-ann": "m-1",
      "cid-prod": "m-3",
      "cid-tech": "m-4",
      "cid-lab": "m-5",
    } as Record<string, string>,
  });

  const channelSearch = ref<string>("");
  const channelTab = ref<"joined" | "discover">("joined");
  const composerDraft = ref<string>("");
  const selectedDomainId = ref<string>("Core:Text");
  const replyToMessageId = ref<string>("");
  const messageActionError = ref<ChatMessageActionErrorInfo | null>(null);
  const currentChannelId = ref<string>("cid-prod");
  const sendAttempt = ref<number>(0);

  const channels = computed(() => {
    const needle = channelSearch.value.trim().toLowerCase();
    const base: ChatChannel[] = [];
    const showJoined = channelTab.value === "joined";
    for (const c of state.channels) {
      const ok = showJoined ? c.joined : !c.joined;
      if (ok) base.push(c);
    }
    if (!needle) return base;
    const filtered: ChatChannel[] = [];
    for (const c of base) {
      if (c.name.toLowerCase().includes(needle) || c.id.toLowerCase().includes(needle)) filtered.push(c);
    }
    return filtered;
  });

  const allChannels = computed(() => state.channels);
  const members = computed(() => state.members);
  const currentMessages = computed(() => state.messagesByChannel[currentChannelId.value] ?? []);
  const currentChannelHasMore = computed(() => false);
  const loadingMoreMessages = computed(() => false);
  const currentChannelLastReadTimeMs = computed(() => state.lastReadTimeMsByChannel[currentChannelId.value] ?? 0);
  const currentChannelLastReadMid = computed(() => state.lastReadMidByChannel[currentChannelId.value] ?? "");

  /**
   * 确保 mock chat store 已就绪。
   *
   * 说明：
   * mock 模式没有外部依赖，此方法仅用于保持与真实实现的 API 对称。
   *
   * @returns `Promise<void>`。
   */
  async function ensureChatReady(): Promise<void> {
    return;
  }

  /**
   * 获取作曲器（composer）的 domain 列表：core + 已启用插件的 domains。
   *
   * @returns domain 列表。
   */
  function availableDomains(): MessageDomain[] {
    return getAvailableChatMessageDomains(chatCurrentServerSocket.value.trim());
  }

  /**
   * 在某频道内按 id 查找消息。
   *
   * @param channelId - 频道 id。
   * @param messageId - 消息 id。
   * @returns 找到则返回消息，否则返回 `null`。
   */
  function getMessageById(channelId: string, messageId: string): ChatMessage | null {
    const list = state.messagesByChannel[channelId] ?? [];
    for (const m of list) {
      if (m.id === messageId) return m;
    }
    return null;
  }

  /**
   * 选择频道并清空未读计数。
   *
   * @param id - 目标频道 id。
   * @returns 显式频道切换结果。
   */
  async function selectChannel(id: string): Promise<ChannelSelectionOutcome> {
    const channelId = String(id ?? "").trim();
    if (!channelId) {
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: {
          code: "missing_channel_id",
          message: "Missing channel id.",
          retryable: false,
        },
      };
    }
    const channel = state.channels.find((item) => item.id === channelId);
    if (!channel) {
      return {
        ok: false,
        kind: "chat_channel_selection_rejected",
        error: {
          code: "channel_not_found",
          message: "Channel not found.",
          retryable: false,
          details: { channelId },
        },
      };
    }

    currentChannelId.value = channelId;
    for (const c of state.channels) {
      if (c.id === channelId) c.unread = 0;
    }
    state.lastReadTimeMsByChannel[channelId] = Date.now();
    const list = state.messagesByChannel[channelId] ?? [];
    state.lastReadMidByChannel[channelId] = list[list.length - 1]?.id ?? state.lastReadMidByChannel[channelId] ?? "";
    return {
      ok: true,
      kind: "chat_channel_selected",
      channelId,
    };
  }

  /**
   * 上报当前频道已读状态（mock）。
   *
   * @returns `Promise<void>`。
   */
  async function reportCurrentReadState(): Promise<void> {
    const cid = currentChannelId.value.trim();
    if (!cid) return;
    state.lastReadTimeMsByChannel[cid] = Date.now();
    const list = state.messagesByChannel[cid] ?? [];
    state.lastReadMidByChannel[cid] = list[list.length - 1]?.id ?? state.lastReadMidByChannel[cid] ?? "";
  }

  /**
   * 加载更早一页消息（mock）。
   *
   * 说明：
   * mock store 使用有限的内存列表，不支持分页，因此该方法为空实现。
   *
   * @returns `Promise<void>`
   */
  async function loadMoreMessages(): Promise<void> {
    return;
  }

  /**
   * 申请加入某个可发现频道（mock）。
   *
   * @param channelId - 目标频道 id。
   * @returns `Promise<void>`。
   */
  async function applyJoin(channelId: string): Promise<ApplyJoinChannelOutcome> {
    let target: ChatChannel | null = null;
    for (const x of state.channels) {
      if (x.id === channelId) {
        target = x;
        break;
      }
    }
    if (!target) {
      return {
        ok: false,
        kind: "channel_join_applied_rejected",
        error: createGovernanceError("missing_channel_id", "Channel not found.", { channelId }),
      };
    }
    if (target.joined) {
      return {
        ok: true,
        kind: "channel_join_applied",
        channelId,
      };
    }
    target.joinRequested = true;
    window.setTimeout(() => {
      target!.joinRequested = false;
      target!.joined = true;
      channelTab.value = "joined";
      state.lastReadTimeMsByChannel[target!.id] = Date.now();
    }, 650);
    return {
      ok: true,
      kind: "channel_join_applied",
      channelId,
    };
  }

  /**
   * 更新频道展示信息（mock）。
   *
   * @param channelId - 频道 id。
   * @param patch - 部分更新字段。
   * @returns `Promise<void>`。
   */
  async function updateChannelMeta(
    channelId: string,
    patch: Partial<Pick<ChatChannel, "name" | "brief">>,
  ): Promise<UpdateChannelMetaOutcome> {
    let found = false;
    for (const c of state.channels) {
      if (c.id !== channelId) continue;
      found = true;
      if (typeof patch.name === "string") c.name = patch.name.trim() || c.name;
      if (typeof patch.brief === "string") c.brief = patch.brief;
    }
    if (!found) {
      return {
        ok: false,
        kind: "channel_meta_updated_rejected",
        error: createGovernanceError("missing_channel_id", "Channel not found.", { channelId }),
      };
    }
    return {
      ok: true,
      kind: "channel_meta_updated",
      channelId,
    };
  }

  /**
   * 进入回复模式。
   *
   * @param messageId - 需要回复的消息 id。
   * @returns void。
   */
  function startReply(messageId: string): void {
    replyToMessageId.value = messageId;
    messageActionError.value = null;
  }

  /**
   * 退出回复模式（不发送）。
   *
   * @returns void。
   */
  function cancelReply(): void {
    replyToMessageId.value = "";
  }

  /**
   * 从当前频道删除消息（mock 硬删除）。
   *
   * @param messageId - 目标消息 id。
   * @returns 删除结果。
   */
  async function deleteMessage(messageId: string): Promise<DeleteChatMessageOutcome> {
    const list = state.messagesByChannel[currentChannelId.value] ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    if (idx < 0) {
      const error: ChatMessageActionErrorInfo = {
        code: "delete_failed",
        message: "Message not found.",
        retryable: false,
        details: { messageId },
      };
      messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_delete_rejected",
        error,
      };
    }
    list.splice(idx, 1);
    messageActionError.value = null;
    return {
      ok: true,
      kind: "chat_message_deleted",
      messageId,
    };
  }

  /**
   * 发送当前作曲器草稿消息（mock）。
   *
   * @param payload - 可选插件 payload（domain composer 提交）。
   * @returns 发送结果。
   */
  async function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<SendChatMessageOutcome> {
    const uiDomain = selectedDomainId.value.trim();
    const isCoreText = uiDomain === "Core:Text";
    const text = composerDraft.value.trim();
    if (!payload && isCoreText && !text) {
      const error: ChatMessageActionErrorInfo = {
        code: "missing_domain",
        message: "Missing message payload.",
        retryable: false,
      };
      messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }
    if (!payload && !isCoreText) {
      const error: ChatMessageActionErrorInfo = {
        code: "plugin_composer_required",
        message: "This domain requires a plugin composer.",
        retryable: false,
      };
      messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }

    sendAttempt.value += 1;
    if (sendAttempt.value % 5 === 0) {
      const error: ChatMessageActionErrorInfo = {
        code: "send_failed",
        message: "Send failed (mock): link jitter. Draft kept - retry.",
        retryable: true,
      };
      messageActionError.value = error;
      return {
        ok: false,
        kind: "chat_message_send_rejected",
        error,
      };
    }
    messageActionError.value = null;

    const now = Date.now();
    const list = state.messagesByChannel[currentChannelId.value] ?? (state.messagesByChannel[currentChannelId.value] = []);
    const from = { id: String(currentChatUser.value.id || "u-1"), name: currentChatUsername.value || "Operator" };
    const replyToId = replyToMessageId.value || undefined;
    let createdMessage: ChatMessage;

    if (payload) {
      createdMessage = {
        id: `m-${now}`,
        kind: "domain_message",
        from,
        timeMs: now,
        domain: { id: payload.domain, label: payload.domain, colorVar: "--cp-domain-ext-a", version: payload.domainVersion },
        preview: `UNPATCHED SIGNAL · ${payload.domain}@${payload.domainVersion}`,
        data: payload.data,
        replyToId,
      };
      list.push(createdMessage);
    } else {
      createdMessage = {
        id: `m-${now}`,
        kind: "core_text",
        from,
        timeMs: now,
        domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
        text,
        replyToId,
      };
      list.push(createdMessage);
      composerDraft.value = "";
    }

    replyToMessageId.value = "";
    state.lastReadTimeMsByChannel[currentChannelId.value] = now;
    return {
      ok: true,
      kind: "chat_message_sent",
      message: createdMessage,
    };
  }

  // ============================================================================
  // 频道管理方法（mock）
  // ============================================================================

  /**
   * 获取频道成员列表（mock）。
   *
   * @param channelId - 频道 id。
   * @returns `Promise<ChannelMember[]>`。
   */
  async function listMembers(channelId: string): Promise<ChannelMember[]> {
    void channelId;
    return state.members.map((m) => ({
      uid: m.id,
      nickname: m.name,
      role: m.role,
      joinTime: Date.now() - 1000 * 60 * 60 * 24,
    }));
  }

  /**
   * 将成员踢出频道（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function kickMember(channelId: string, uid: string): Promise<KickChannelMemberOutcome> {
    void channelId;
    const before = state.members.length;
    state.members = state.members.filter((m) => m.id !== uid);
    if (state.members.length === before) {
      return {
        ok: false,
        kind: "channel_member_kicked_rejected",
        error: createGovernanceError("missing_user_id", "Member not found.", { channelId, uid }),
      };
    }
    return {
      ok: true,
      kind: "channel_member_kicked",
      channelId,
      uid,
    };
  }

  /**
   * 将用户设为管理员（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function setAdmin(channelId: string, uid: string): Promise<GrantChannelAdminOutcome> {
    void channelId;
    let updated = false;
    for (const m of state.members) {
      if (m.id === uid && m.role === "member") {
        m.role = "admin";
        updated = true;
      }
    }
    if (!updated) {
      return {
        ok: false,
        kind: "channel_admin_granted_rejected",
        error: createGovernanceError("missing_user_id", "Member not found or already elevated.", { channelId, uid }),
      };
    }
    return {
      ok: true,
      kind: "channel_admin_granted",
      channelId,
      uid,
    };
  }

  /**
   * 撤销用户管理员身份（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function removeAdmin(channelId: string, uid: string): Promise<RevokeChannelAdminOutcome> {
    void channelId;
    let updated = false;
    for (const m of state.members) {
      if (m.id === uid && m.role === "admin") {
        m.role = "member";
        updated = true;
      }
    }
    if (!updated) {
      return {
        ok: false,
        kind: "channel_admin_revoked_rejected",
        error: createGovernanceError("missing_user_id", "Admin not found.", { channelId, uid }),
      };
    }
    return {
      ok: true,
      kind: "channel_admin_revoked",
      channelId,
      uid,
    };
  }

  /**
   * 获取入群申请列表（mock）。
   *
   * @param channelId - 频道 id。
   * @returns `Promise<ChannelApplication[]>`。
   */
  async function listApplications(channelId: string): Promise<ChannelApplication[]> {
    return [
      {
        applicationId: "app-1",
        cid: channelId,
        uid: "u-new-1",
        nickname: "NewUser",
        reason: "Want to join the discussion",
        applyTime: Date.now() - 1000 * 60 * 30,
        status: "pending",
      },
    ];
  }

  /**
   * 审批入群申请（mock）。
   *
   * @param channelId - 频道 id。
   * @param applicationId - 申请 id。
   * @param approved - 是否通过。
   * @returns `Promise<void>`。
   */
  async function decideApplication(
    channelId: string,
    applicationId: string,
    approved: boolean,
  ): Promise<DecideChannelApplicationOutcome> {
    void channelId;
    void applicationId;
    if (approved) {
      state.members.push({ id: "u-new-1", name: "NewUser", role: "member" });
    }
    return {
      ok: true,
      kind: "channel_application_decided",
      channelId,
      applicationId,
      decision: approved ? "approve" : "reject",
    };
  }

  /**
   * 获取禁言/封禁列表（mock）。
   *
   * @param channelId - 频道 id。
   * @returns `Promise<ChannelBan[]>`。
   */
  async function listBans(channelId: string): Promise<ChannelBan[]> {
    void channelId;
    return [];
  }

  /**
   * 设置禁言/封禁（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @param until - 截止时间戳（ms）。
   * @param reason - 原因。
   * @returns `Promise<void>`。
   */
  async function setBan(channelId: string, uid: string, until: number, reason: string): Promise<SetChannelBanOutcome> {
    void reason;
    return {
      ok: true,
      kind: "channel_ban_upserted",
      channelId,
      uid,
      until,
    };
  }

  /**
   * 解除禁言/封禁（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function removeBan(channelId: string, uid: string): Promise<RemoveChannelBanOutcome> {
    return {
      ok: true,
      kind: "channel_ban_removed",
      channelId,
      uid,
    };
  }

  /**
   * 创建频道（mock）。
   *
   * @param name - 频道名称。
   * @param brief - 频道简介。
   * @returns `Promise<ChatChannel>`。
   */
  async function createChannel(name: string, brief?: string): Promise<CreateChannelOutcome> {
    if (!name.trim()) {
      return {
        ok: false,
        kind: "channel_created_rejected",
        error: createGovernanceError("missing_channel_name", "Channel name is required."),
      };
    }
    const newChannel: ChatChannel = {
      id: `cid-${Date.now()}`,
      name: name.trim(),
      brief: brief?.trim() ?? "",
      unread: 0,
      joined: true,
      joinRequested: false,
    };
    state.channels.push(newChannel);
    state.messagesByChannel[newChannel.id] = [];
    state.lastReadTimeMsByChannel[newChannel.id] = Date.now();
    state.lastReadMidByChannel[newChannel.id] = "";
    return {
      ok: true,
      kind: "channel_created",
      channel: newChannel as GovernanceChannelSummary,
    };
  }

  /**
   * 删除频道（mock）。
   *
   * @param channelId - 频道 id。
   * @returns `Promise<void>`。
   */
  async function deleteChannel(channelId: string): Promise<DeleteChannelOutcome> {
    const existed = state.channels.some((c) => c.id === channelId);
    if (!existed) {
      return {
        ok: false,
        kind: "channel_deleted_rejected",
        error: createGovernanceError("missing_channel_id", "Channel not found.", { channelId }),
      };
    }
    state.channels = state.channels.filter((c) => c.id !== channelId);
    delete state.messagesByChannel[channelId];
    delete state.lastReadTimeMsByChannel[channelId];
    delete state.lastReadMidByChannel[channelId];
    if (currentChannelId.value === channelId) {
      currentChannelId.value = state.channels[0]?.id ?? "";
    }
    return {
      ok: true,
      kind: "channel_deleted",
      channelId,
    };
  }

  return {
    channels,
    allChannels,
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    messageActionError,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadingMoreMessages,
    currentChannelLastReadTimeMs,
    currentChannelLastReadMid,
    members,
    ensureChatReady,
    availableDomains,
    getMessageById,
    selectChannel,
    reportCurrentReadState,
    loadMoreMessages,
    applyJoin,
    updateChannelMeta,
    startReply,
    cancelReply,
    deleteMessage,
    sendComposerMessage,
    // 频道管理
    listMembers,
    kickMember,
    setAdmin,
    removeAdmin,
    listApplications,
    decideApplication,
    listBans,
    setBan,
    removeBan,
    createChannel,
    deleteChannel,
  };
}
