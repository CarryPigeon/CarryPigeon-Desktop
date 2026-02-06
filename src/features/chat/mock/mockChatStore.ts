/**
 * @fileoverview mockChatStore.ts
 * @description chat｜Mock 实现：mockChatStore（用于本地预览/测试）。
 */

import { computed, reactive, ref } from "vue";
import { usePluginCatalogStore, usePluginInstallStore } from "@/features/plugins/api";
import { currentServerSocket } from "@/features/servers/api";
import { currentUser } from "@/features/user/api";
import type {
  ChatChannel,
  ChatMember,
  ChatMessage,
  ChatStore,
  MessageDomain,
  ComposerSubmitPayload,
  ChannelMember,
  ChannelApplication,
  ChannelBan,
} from "../presentation/store/chatStoreTypes";

/**
 * 创建 mock store 实现（纯内存）。
 *
 * @returns `ChatStore`。
 */
export function createMockChatStore(): ChatStore {
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
  });

  const channelSearch = ref<string>("");
  const channelTab = ref<"joined" | "discover">("joined");
  const composerDraft = ref<string>("");
  const selectedDomainId = ref<string>("Core:Text");
  const replyToMessageId = ref<string>("");
  const sendError = ref<string>("");
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
    const socket = currentServerSocket.value.trim();
    const catalog = usePluginCatalogStore(socket).catalog.value;
    const install = usePluginInstallStore(socket).installedById;

    const enabledDomains: MessageDomain[] = [];
    for (const p of catalog) {
      const st = install[p.pluginId];
      const ok = Boolean(st?.enabled) && st?.status === "ok";
      if (!ok) continue;
      for (const d of p.providesDomains) enabledDomains.push({ ...d, pluginIdHint: p.pluginId });
    }

    const core: MessageDomain = { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core", pluginIdHint: "core.text", version: "1.0.0" };
    const unique = new Map<string, MessageDomain>();
    unique.set(core.id, core);
    for (const d of enabledDomains) unique.set(d.id, d);
    return Array.from(unique.values());
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
   * @returns `Promise<void>`。
   */
  async function selectChannel(id: string): Promise<void> {
    currentChannelId.value = id;
    for (const c of state.channels) {
      if (c.id === id) c.unread = 0;
    }
    state.lastReadTimeMsByChannel[id] = Date.now();
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
  async function applyJoin(channelId: string): Promise<void> {
    let target: ChatChannel | null = null;
    for (const x of state.channels) {
      if (x.id === channelId) {
        target = x;
        break;
      }
    }
    if (!target || target.joined) return;
    target.joinRequested = true;
    window.setTimeout(() => {
      target!.joinRequested = false;
      target!.joined = true;
      channelTab.value = "joined";
      state.lastReadTimeMsByChannel[target!.id] = Date.now();
    }, 650);
  }

  /**
   * 更新频道展示信息（mock）。
   *
   * @param channelId - 频道 id。
   * @param patch - 部分更新字段。
   * @returns `Promise<void>`。
   */
  async function updateChannelMeta(channelId: string, patch: Partial<Pick<ChatChannel, "name" | "brief">>): Promise<void> {
    for (const c of state.channels) {
      if (c.id !== channelId) continue;
      if (typeof patch.name === "string") c.name = patch.name.trim() || c.name;
      if (typeof patch.brief === "string") c.brief = patch.brief;
    }
  }

  /**
   * 进入回复模式。
   *
   * @param messageId - 需要回复的消息 id。
   * @returns void。
   */
  function startReply(messageId: string): void {
    replyToMessageId.value = messageId;
    sendError.value = "";
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
   * @returns `Promise<void>`。
   */
  async function deleteMessage(messageId: string): Promise<void> {
    const list = state.messagesByChannel[currentChannelId.value] ?? [];
    const idx = list.findIndex((m) => m.id === messageId);
    if (idx >= 0) list.splice(idx, 1);
  }

  /**
   * 发送当前作曲器草稿消息（mock）。
   *
   * @param payload - 可选插件 payload（domain composer 提交）。
   * @returns `Promise<void>`。
   */
  async function sendComposerMessage(payload?: ComposerSubmitPayload): Promise<void> {
    const uiDomain = selectedDomainId.value.trim();
    const isCoreText = uiDomain === "Core:Text";
    const text = composerDraft.value.trim();
    if (!payload && isCoreText && !text) return;
    if (!payload && !isCoreText) {
      sendError.value = "This domain requires a plugin composer.";
      return;
    }

    sendAttempt.value += 1;
    if (sendAttempt.value % 5 === 0) {
      sendError.value = "Send failed (mock): link jitter. Draft kept — retry.";
      return;
    }
    sendError.value = "";

    const now = Date.now();
    const list = state.messagesByChannel[currentChannelId.value] ?? (state.messagesByChannel[currentChannelId.value] = []);
    const from = { id: String(currentUser.id || "u-1"), name: currentUser.username || "Operator" };
    const replyToId = replyToMessageId.value || undefined;

    if (payload) {
      list.push({
        id: `m-${now}`,
        kind: "domain_message",
        from,
        timeMs: now,
        domain: { id: payload.domain, label: payload.domain, colorVar: "--cp-domain-ext-a", version: payload.domain_version },
        preview: `UNPATCHED SIGNAL · ${payload.domain}@${payload.domain_version}`,
        data: payload.data,
        replyToId,
      });
    } else {
      list.push({
        id: `m-${now}`,
        kind: "core_text",
        from,
        timeMs: now,
        domain: { id: "Core:Text", label: "Core:Text", colorVar: "--cp-domain-core" },
        text,
        replyToId,
      });
      composerDraft.value = "";
    }

    replyToMessageId.value = "";
    state.lastReadTimeMsByChannel[currentChannelId.value] = now;
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
  async function kickMember(channelId: string, uid: string): Promise<void> {
    void channelId;
    state.members = state.members.filter((m) => m.id !== uid);
  }

  /**
   * 将用户设为管理员（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function setAdmin(channelId: string, uid: string): Promise<void> {
    void channelId;
    for (const m of state.members) {
      if (m.id === uid && m.role === "member") {
        m.role = "admin";
      }
    }
  }

  /**
   * 撤销用户管理员身份（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function removeAdmin(channelId: string, uid: string): Promise<void> {
    void channelId;
    for (const m of state.members) {
      if (m.id === uid && m.role === "admin") {
        m.role = "member";
      }
    }
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
  async function decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void> {
    void channelId;
    void applicationId;
    if (approved) {
      state.members.push({ id: "u-new-1", name: "NewUser", role: "member" });
    }
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
  async function setBan(channelId: string, uid: string, until: number, reason: string): Promise<void> {
    void channelId;
    void uid;
    void until;
    void reason;
    return;
  }

  /**
   * 解除禁言/封禁（mock）。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns `Promise<void>`。
   */
  async function removeBan(channelId: string, uid: string): Promise<void> {
    void channelId;
    void uid;
    return;
  }

  /**
   * 创建频道（mock）。
   *
   * @param name - 频道名称。
   * @param brief - 频道简介。
   * @returns `Promise<ChatChannel>`。
   */
  async function createChannel(name: string, brief?: string): Promise<ChatChannel> {
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
    return newChannel;
  }

  /**
   * 删除频道（mock）。
   *
   * @param channelId - 频道 id。
   * @returns `Promise<void>`。
   */
  async function deleteChannel(channelId: string): Promise<void> {
    state.channels = state.channels.filter((c) => c.id !== channelId);
    delete state.messagesByChannel[channelId];
    delete state.lastReadTimeMsByChannel[channelId];
    if (currentChannelId.value === channelId) {
      currentChannelId.value = state.channels[0]?.id ?? "";
    }
  }

  return {
    channels,
    allChannels,
    channelSearch,
    channelTab,
    composerDraft,
    selectedDomainId,
    replyToMessageId,
    sendError,
    currentChannelId,
    currentMessages,
    currentChannelHasMore,
    loadingMoreMessages,
    currentChannelLastReadTimeMs,
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
