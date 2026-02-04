<script setup lang="ts">
/**
 * @fileoverview 聊天主页面（Patchbay 主窗口）
 * @description 路由 `/chat` 的主窗口：机架（服务器）/频道/消息流/编辑器/成员列表。
 */

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { serverRacks } from "@/features/servers/presentation/store/serverList";
import { useServerInfoStore } from "@/features/servers/presentation/store/serverInfoStore";
import { connectWithRetry, connectionDetail, connectionPillState, retryLast } from "@/features/network/presentation/store/connectionStore";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import LabelBadge from "@/shared/ui/LabelBadge.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { usePluginCatalogStore } from "@/features/plugins/presentation/store/pluginCatalogStore";
import { usePluginInstallStore } from "@/features/plugins/presentation/store/pluginInstallStore";
import { useDomainRegistryStore } from "@/features/plugins/presentation/store/domainRegistryStore";
import { useDomainCatalogStore } from "@/features/plugins/presentation/store/domainCatalogStore";
import type { PluginComposerPayload } from "@/features/plugins/data/pluginRuntime";
import {
  channels,
  allChannels,
  channelSearch,
  channelTab,
  composerDraft,
  currentChannelId,
  currentMessages,
  currentChannelHasMore,
  loadingMoreMessages,
  currentChannelLastReadTimeMs,
  getMessageById,
  members,
  ensureChatReady,
  availableDomains,
  selectChannel,
  reportCurrentReadState,
  applyJoin,
  selectedDomainId,
  replyToMessageId,
  sendError,
  startReply,
  cancelReply,
  deleteMessage,
  loadMoreMessages,
  sendComposerMessage,
  type ChatMessage,
} from "@/features/chat/presentation/store/chatStore";
import SignalStrip from "@/features/chat/presentation/components/messages/SignalStrip.vue";
import UnknownDomainCard from "@/features/chat/presentation/components/messages/UnknownDomainCard.vue";
import ComposerHost from "@/features/chat/presentation/components/inputs/ComposerHost.vue";
import MessageContextMenu, { type MessageMenuAction } from "@/features/chat/presentation/components/messages/MessageContextMenu.vue";
import QuickSwitcher, { type QuickSwitcherItem } from "@/features/chat/presentation/components/QuickSwitcher.vue";
import {
  closeQuickSwitcher,
  openQuickSwitcher,
  quickSwitcherActiveIndex,
  quickSwitcherOpen,
  quickSwitcherQuery,
} from "@/features/chat/presentation/store/quickSwitcherStore";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { currentUser } from "@/features/user/presentation/store/userData";
import CreateChannelDialog from "@/features/chat/presentation/components/CreateChannelDialog.vue";
import DeleteChannelDialog from "@/features/chat/presentation/components/DeleteChannelDialog.vue";
import FileUploadButton from "@/features/files/presentation/components/FileUploadButton.vue";
import FileMessageBubble from "@/features/files/presentation/components/FileMessageBubble.vue";

const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const flashMessage = ref<string>("");
const signalPaneRef = ref<HTMLElement | null>(null);
let autoLoadCooldown = 0;
let pendingScrollToBottom = false;
const showJumpToBottom = ref(false);

/**
 * 计算当前 server socket key。
 *
 * @returns 裁剪后的 socket 字符串。
 */
function computeSocket(): string {
  return currentServerSocket.value.trim();
}

const socket = computed(computeSocket);

/**
 * 解析当前 socket 对应的 server-info store。
 *
 * @returns server-info store 实例。
 */
function computeServerInfoStore() {
  return useServerInfoStore(socket.value);
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * 暴露 `server_id` 供 UI 展示与行为开关使用。
 *
 * @returns 当前 server_id（缺失时为空字符串）。
 */
function computeServerId(): string {
  return serverInfoStore.value.info.value?.serverId ?? "";
}

const serverId = computed(computeServerId);

/**
 * 解析当前 socket 对应的插件目录 store。
 *
 * @returns 插件目录 store。
 */
function computeCatalogStore() {
  return usePluginCatalogStore(socket.value);
}

const catalogStore = computed(computeCatalogStore);

/**
 * 解析当前 socket 对应的插件安装状态 store。
 *
 * @returns 插件安装状态 store。
 */
function computeInstallStore() {
  return usePluginInstallStore(socket.value);
}

const installStore = computed(computeInstallStore);

/**
 * 解析当前 socket 对应的服务端 domain catalog store。
 *
 * @returns domain catalog store。
 */
function computeDomainCatalogStore() {
  return useDomainCatalogStore(socket.value);
}

const domainCatalogStore = computed(computeDomainCatalogStore);

/**
 * 解析当前 socket 对应的 domain registry store（插件 domain 绑定注册表）。
 *
 * @returns domain registry store。
 */
function computeDomainRegistryStore() {
  return useDomainRegistryStore(socket.value);
}

const domainRegistryStore = computed(computeDomainRegistryStore);

/**
 * 解析当前所选 domain 对应的插件编辑器组件（composer）。
 *
 * @returns Vue 组件；不存在时为 `null`。
 */
function computeActivePluginComposer() {
  return domainRegistryStore.value.bindingByDomain[selectedDomainId.value]?.composer ?? null;
}

const activePluginComposer = computed(computeActivePluginComposer);

/**
 * 解析当前编辑器对应的插件上下文（每次访问重新生成，避免跨频道/跨 socket 污染）。
 *
 * @returns PluginContext 对象；不存在时为 `null`。
 */
function computeActivePluginContext() {
  const binding = domainRegistryStore.value.bindingByDomain[selectedDomainId.value] ?? null;
  if (!binding) return null;
  return domainRegistryStore.value.getContextForPlugin(binding.pluginId);
}

const activePluginContext = computed(computeActivePluginContext);

/**
 * 将 host bridge 注入到 domain registry，使插件能够发送消息。
 *
 * 设计目的：避免 registry 直接 import chat store（防止循环依赖）。
 *
 * @returns void
 */
function attachPluginHostBridge(): void {
  domainRegistryStore.value.setHostBridge({
    getCid() {
      return currentChannelId.value;
    },
    async sendMessage(payload: PluginComposerPayload) {
      await sendComposerMessage(payload);
    },
  });
}

/**
 * 计算当前服务器声明的必需插件 id 列表。
 *
 * @returns 必需插件 id 数组。
 */
function computeRequiredIds(): string[] {
  const declared = serverInfoStore.value.info.value?.requiredPlugins ?? null;
  if (Array.isArray(declared) && declared.length > 0) {
    return declared.map((x) => String(x).trim()).filter(Boolean);
  }
  const out: string[] = [];
  for (const p of catalogStore.value.catalog.value) {
    if (p.source === "server" && p.required) out.push(p.pluginId);
  }
  return out;
}

const requiredIds = computed(computeRequiredIds);

/**
 * 计算仍缺失的必需插件数量（未启用或状态非 ok）。
 *
 * @returns 缺失数量（0 表示 gate 满足）。
 */
function computeMissingRequiredCount(): number {
  let missing = 0;
  for (const id of requiredIds.value) {
    const s = installStore.value.installedById[id];
    const ok = Boolean(s?.enabled) && s?.status === "ok";
    if (!ok) missing += 1;
  }
  return missing;
}

const missingRequiredCount = computed(computeMissingRequiredCount);

/**
 * 构造 `ComposerHost` 的 domain 下拉选项。
 *
 * @returns domain 选项列表。
 */
function computeDomainOptions(): Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }> {
  const out: Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }> = [];
  for (const d of availableDomains()) out.push({ id: d.id, label: d.label, colorVar: d.colorVar });
  return out;
}

const domainOptions = computed(computeDomainOptions);

type MessageRow = {
  m: ChatMessage;
  isGroupStart: boolean;
  isUnreadStart: boolean;
};

type CoreTextPart = { kind: "text"; text: string } | { kind: "file"; shareKey: string };

/**
 * 检查 core-text 消息是否包含 `[file:share_key]` token。
 *
 * 这是一个轻量的 UI 约定：在引入“文件 domain 消息”之前，先用 token 表达附件引用，
 * 供 `FileUploadButton` 与消息气泡渲染使用。
 *
 * @param text - 消息文本。
 * @returns 当至少包含一个 token 时返回 `true`。
 */
function hasFileToken(text: string): boolean {
  return /\[file:([^\]\s]+)\]/i.test(String(text ?? ""));
}

/**
 * 将 core-text 消息解析为可渲染分段（纯文本 + 文件 token）。
 *
 * 标记（token）格式：`[file:{share_key}]`
 *
 * @param text - 原始消息文本。
 * @returns 供模板渲染使用的分段结果。
 */
function parseCoreTextParts(text: string): CoreTextPart[] {
  const s = String(text ?? "");
  const out: CoreTextPart[] = [];
  const re = /\[file:([^\]\s]+)\]/gi;
  let lastIdx = 0;

  for (const m of s.matchAll(re)) {
    const start = m.index ?? 0;
    const end = start + String(m[0] ?? "").length;
    const shareKey = String(m[1] ?? "").trim();
    if (start > lastIdx) out.push({ kind: "text", text: s.slice(lastIdx, start) });
    if (shareKey) out.push({ kind: "file", shareKey });
    else out.push({ kind: "text", text: s.slice(start, end) });
    lastIdx = end;
  }

  if (lastIdx < s.length) out.push({ kind: "text", text: s.slice(lastIdx) });
  if (out.length === 0) out.push({ kind: "text", text: s });
  return out;
}

/**
 * 计算消息列表的视图模型行（view-model rows）。
 *
 * 衍生 UI 标记：
 * - `isGroupStart`：是否为“分组起点”（控制 meta + 头像展示）。
 * - `isUnreadStart`：是否为“未读起点”（展示 UNREAD 分隔符）。
 *
 * @returns 供模板渲染的消息行列表。
 */
function computeMessageRows(): MessageRow[] {
  const list = currentMessages.value;
  const lastRead = currentChannelLastReadTimeMs.value;
  const rows: MessageRow[] = [];

  for (let idx = 0; idx < list.length; idx += 1) {
    const m = list[idx];
    const prev = idx > 0 ? list[idx - 1] : null;
    let sameSender = false;
    let closeInTime = false;
    if (prev) {
      sameSender = prev.from.id === m.from.id;
      closeInTime = Math.abs(m.timeMs - prev.timeMs) < 1000 * 90;
    }
    const isGroupStart = !(sameSender && closeInTime);
    const isUnreadStart = m.timeMs > lastRead && (!prev || prev.timeMs <= lastRead);
    rows.push({ m, isGroupStart, isUnreadStart });
  }

  return rows;
}

const messageRows = computed<MessageRow[]>(computeMessageRows);

/**
 * 计算当前“回复预览”（显示在编辑器上方）。
 *
 * @returns 回复预览模型。
 */
function computeReplyPreview(): { title: string; snippet: string } {
  const id = replyToMessageId.value;
  if (!id) return { title: "", snippet: "" };
  const msg = getMessageById(currentChannelId.value, id);
  if (!msg) return { title: "Reply", snippet: "Message not found" };
  const snippet = msg.kind === "core_text" ? msg.text : msg.preview;
  return { title: `Reply → ${msg.from.name}`, snippet };
}

const replyPreview = computed(computeReplyPreview);

const menuOpen = ref(false);
const menuX = ref(0);
const menuY = ref(0);
const menuMessageId = ref<string>("");

// 频道管理弹窗状态
const showCreateChannel = ref(false);
const showDeleteChannel = ref(false);
const deleteChannelId = ref("");
const deleteChannelName = ref("");
const showChannelMenu = ref(false);
const channelMenuX = ref(0);
const channelMenuY = ref(0);

/**
 * 计算 mock chat store 使用的当前用户 id。
 *
 * @returns 当前用户 id（字符串）。
 */
function computeCurrentUserId(): string {
  return String(currentUser.id || "u-1");
}

const currentUserId = computed(computeCurrentUserId);

/**
 * 构造 QuickSwitcher 的候选项（服务器/频道/模块 + 常用路由）。
 *
 * @returns 基于当前查询过滤后的候选项列表。
 */
function computeQuickSwitcherItems(): QuickSwitcherItem[] {
  const needle = quickSwitcherQuery.value.trim().toLowerCase();
  const all: QuickSwitcherItem[] = [];

  all.push({ kind: "route", id: "/plugins", title: "Plugin Center", subtitle: "/plugins" });
  all.push({ kind: "route", id: "/required-setup", title: "Required Setup", subtitle: "/required-setup" });
  all.push({ kind: "route", id: "/settings", title: "Settings", subtitle: "/settings" });
  all.push({ kind: "route", id: "/", title: "Login", subtitle: "/" });

  for (const s of serverRacks.value) all.push({ kind: "server", id: s.serverSocket, title: s.name, subtitle: s.serverSocket });
  for (const c of allChannels.value) all.push({ kind: "channel", id: c.id, title: c.name, subtitle: c.id });
  for (const p of catalogStore.value.catalog.value) all.push({ kind: "module", id: p.pluginId, title: p.name, subtitle: p.pluginId });

  if (!needle) return all;

  const filtered: QuickSwitcherItem[] = [];
  for (const it of all) {
    const hay = `${it.title} ${it.subtitle} ${it.id}`.toLowerCase();
    if (hay.includes(needle)) filtered.push(it);
  }
  return filtered;
}

const qsItems = computed<QuickSwitcherItem[]>(computeQuickSwitcherItems);

/**
 * 更新编辑器的 domain 选择。
 *
 * @param v - domain id（例如 `Core:Text`）。
 */
function setDomainId(v: string): void {
  selectedDomainId.value = v;
}

/**
 * 更新当前编辑器草稿文本。
 *
 * @param v - 新的草稿文本。
 */
function setDraft(v: string): void {
  composerDraft.value = v;
}

/**
 * 格式化消息 meta 行展示的时间戳。
 *
 * @param ms - 毫秒级时间戳（epoch ms）。
 * @returns 本地化的短时间字符串（HH:MM）。
 */
function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * 跳转到插件中心；当缺少必需模块时，默认切到“required”过滤器。
 */
function goPlugins(): void {
  void router.push({ path: "/plugins", query: missingRequiredCount.value > 0 ? { filter: "required" } : {} });
}

/**
 * 按 id 从展示层 store 中查找频道。
 *
 * @param channelId - 频道 id。
 * @returns 找到则返回频道；否则返回 `null`。
 */
function findChannelById(channelId: string): (typeof allChannels.value)[number] | null {
  const list = allChannels.value;
  for (const item of list) {
    if (item.id === channelId) return item;
  }
  return null;
}

/**
 * 打开频道信息预览页（轻量只读）。
 *
 * 说明：该预览页通过 query 参数传递频道信息（用于快速查看，不依赖额外拉取）。
 *
 * @param channelId - 频道 id。
 */
function openChannelInfo(channelId: string): void {
  const ch = findChannelById(channelId);
  if (!ch) return;
  void router.push({
    path: "/channel-info",
    query: {
      id: ch.id,
      name: ch.name,
      bio: ch.brief,
    },
  });
}

/**
 * 打开频道成员管理页。
 *
 * @param channelId - 频道 id。
 */
function openChannelMembers(channelId: string): void {
  const ch = findChannelById(channelId);
  if (!ch) return;
  void router.push({
    path: "/channel-members",
    query: { id: ch.id, name: ch.name },
  });
}

/**
 * 打开入群申请管理页。
 *
 * @param channelId - 频道 id。
 */
function openJoinApplications(channelId: string): void {
  const ch = findChannelById(channelId);
  if (!ch) return;
  void router.push({
    path: "/channel-applications",
    query: { id: ch.id, name: ch.name },
  });
}

/**
 * 打开封禁管理页。
 *
 * @param channelId - 频道 id。
 */
function openChannelBans(channelId: string): void {
  const ch = findChannelById(channelId);
  if (!ch) return;
  void router.push({
    path: "/channel-bans",
    query: { id: ch.id, name: ch.name },
  });
}

/**
 * 打开频道设置菜单。
 *
 * @param e - 鼠标事件。
 */
function openChannelSettingsMenu(e: MouseEvent): void {
  e.preventDefault();
  channelMenuX.value = e.clientX;
  channelMenuY.value = e.clientY;
  showChannelMenu.value = true;
}

/**
 * 关闭频道设置菜单。
 */
function closeChannelMenu(): void {
  showChannelMenu.value = false;
}

/**
 * 处理“频道创建成功”事件。
 *
 * @param channel - 新创建的频道信息。
 */
function handleChannelCreated(channel: { id: string; name: string }): void {
  selectChannel(channel.id);
}

/**
 * 打开“删除频道”确认弹窗。
 */
function openDeleteChannelDialog(): void {
  const ch = findChannelById(currentChannelId.value);
  if (!ch) return;
  deleteChannelId.value = ch.id;
  deleteChannelName.value = ch.name;
  showDeleteChannel.value = true;
  closeChannelMenu();
}

/**
 * 处理“频道删除成功”事件。
 */
function handleChannelDeleted(): void {
  const remaining = channels.value;
  if (remaining.length > 0) {
    selectChannel(remaining[0].id);
  }
}

/**
 * 处理文件上传成功：将分享 key 以 token 的方式写入草稿。
 *
 * @param result - 上传结果。
 */
function handleFileUploaded(result: { fileId: string; shareKey: string }): void {
  const text = composerDraft.value;
  composerDraft.value = text ? `${text}\n[file:${result.shareKey}]` : `[file:${result.shareKey}]`;
}

/**
 * 处理文件上传失败：将错误写入发送错误提示。
 *
 * @param error - 错误信息。
 */
function handleFileUploadError(error: string): void {
  sendError.value = error;
}

/**
 * 加载更早一页消息，同时保持滚动位置稳定。
 *
 * 目的：在头部 prepend 历史消息时避免列表“跳动”。
 *
 * @returns Promise<void>
 */
async function handleLoadMoreMessages(): Promise<void> {
  const el = signalPaneRef.value;
  if (!el) {
    await loadMoreMessages();
    return;
  }
  const prevHeight = el.scrollHeight;
  const prevTop = el.scrollTop;
  await loadMoreMessages();
  await nextTick();
  const nextHeight = el.scrollHeight;
  const delta = nextHeight - prevHeight;
  el.scrollTop = prevTop + delta;
}

/**
 * 滚动处理：到达顶部时自动加载更早历史消息。
 *
 * @returns void
 */
function handleSignalScroll(): void {
  const el = signalPaneRef.value;
  if (!el) return;
  showJumpToBottom.value = !isSignalAtBottom();
  maybeReportReadState();
  if (!currentChannelHasMore.value || loadingMoreMessages.value) return;
  if (el.scrollTop > 40) return;
  const now = Date.now();
  if (now - autoLoadCooldown < 900) return;
  autoLoadCooldown = now;
  void handleLoadMoreMessages();
}

/**
 * 判断消息面板是否已滚动到底部。
 *
 * @returns 当用户接近底部时返回 `true`。
 */
function isSignalAtBottom(): boolean {
  const el = signalPaneRef.value;
  if (!el) return true;
  const gap = el.scrollHeight - (el.scrollTop + el.clientHeight);
  return gap < 60;
}

/**
 * 尽力上报已读状态：当用户到达底部时认为已读。
 *
 * @returns void
 */
function maybeReportReadState(): void {
  if (!isSignalAtBottom()) return;
  void reportCurrentReadState();
}

/**
 * 将消息面板滚动到底部，并隐藏“跳到底部”的入口。
 *
 * @returns void
 */
function scrollSignalToBottom(): void {
  const el = signalPaneRef.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
  showJumpToBottom.value = false;
}

/**
 * “跳到底部”按钮处理。
 *
 * @returns void
 */
function handleJumpToBottom(): void {
  scrollSignalToBottom();
  maybeReportReadState();
}

/**
 * 窗口聚焦处理：当用户返回且处于底部时，尽力标记为已读。
 *
 * @returns void
 */
function handleWindowFocus(): void {
  maybeReportReadState();
}

/**
 * 页面可见性处理：从后台切回可见时，尽力标记为已读。
 *
 * @returns void
 */
function handleVisibilityChange(): void {
  if (document.visibilityState !== "visible") return;
  maybeReportReadState();
}

/**
 * 监听源（watch）：当前频道 id。
 *
 * @returns 当前频道 id。
 */
function watchChannelId(): string {
  return currentChannelId.value;
}

/**
 * 标记：下一次消息加载完成后需要滚到底部（用于切换频道后的首次定位）。
 *
 * @returns void
 */
function handleChannelIdChanged(): void {
  pendingScrollToBottom = true;
}

watch(watchChannelId, handleChannelIdChanged);

/**
 * 监听源（watch）：当前频道消息数量。
 *
 * @returns 当前消息数量。
 */
function watchCurrentMessageCount(): number {
  return currentMessages.value.length;
}

watch(watchCurrentMessageCount, async (nextCount, prevCount) => {
  const el = signalPaneRef.value;
  if (!el) return;

  // 切换频道后的首次加载：在消息准备好后强制滚到底部。
  if (pendingScrollToBottom) {
    if (nextCount <= 0) return;
    await nextTick();
    scrollSignalToBottom();
    pendingScrollToBottom = false;
    maybeReportReadState();
    return;
  }

  // 新消息到达时：若用户当前在底部，则保持视口锚定到底部，并尽力上报已读状态。
  if (nextCount <= prevCount) return;
  if (!isSignalAtBottom()) {
    showJumpToBottom.value = true;
    return;
  }
  await nextTick();
  scrollSignalToBottom();
  maybeReportReadState();
});

/**
 * 切换 server socket，并刷新与 server 绑定的各类 store。
 *
 * @param s - 目标 server socket。
 */
function handleSwitchServer(s: string): void {
  setServerSocket(s);
  void connectWithRetry(s)
    .then(refreshServerInfo)
    .then(refreshCatalog)
    .then(refreshDomainCatalog)
    .then(refreshInstalled)
    .then(ensurePluginRuntime)
    .then(ensureChatReady);
}

/**
 * 连接成功后刷新 server-info（用于 promise 链）。
 *
 * @returns Promise<void>
 */
function refreshServerInfo(): Promise<void> {
  return serverInfoStore.value.refresh();
}

/**
 * 在 server-info 刷新后再刷新插件目录（用于 promise 链）。
 *
 * @returns Promise<void>
 */
function refreshCatalog(): Promise<void> {
  return catalogStore.value.refresh();
}

/**
 * 在 server-info 刷新后再刷新 domain catalog（用于 promise 链）。
 *
 * @returns Promise<void>
 */
function refreshDomainCatalog(): Promise<void> {
  return domainCatalogStore.value.refresh();
}

/**
 * 插件目录刷新后再刷新安装状态（用于 promise 链）。
 *
 * @returns Promise<void>
 */
function refreshInstalled(): Promise<void> {
  return installStore.value.refreshInstalled();
}

/**
 * 确保已启用的插件运行时被加载（用于消息渲染/编辑器插件能力）。
 *
 * @returns Promise<void>
 */
function ensurePluginRuntime(): Promise<void> {
  if (!serverId.value) return Promise.resolve();
  return domainRegistryStore.value.ensureLoaded();
}

/**
 * 跳转到插件中心；若存在插件 id 提示，则聚焦到该插件。
 *
 * @param pluginId - 来自未知 domain 消息的插件 id hint。
 */
function handleInstallHint(pluginId: string | undefined): void {
  if (!pluginId) {
    void router.push("/plugins");
    return;
  }
  void router.push({ path: "/plugins", query: { focus_plugin_id: pluginId } });
}

/**
 * 在鼠标指针位置打开消息上下文菜单。
 *
 * @param e - 鼠标事件。
 * @param messageId - 菜单操作作用的目标消息 id。
 * @returns void
 */
function openMenuForMessage(e: MouseEvent, messageId: string): void {
  e.preventDefault();
  menuMessageId.value = messageId;
  menuX.value = e.clientX;
  menuY.value = e.clientY;
  menuOpen.value = true;
}

/**
 * 关闭消息上下文菜单。
 *
 * @returns void
 */
function closeMenu(): void {
  menuOpen.value = false;
}

/**
 * 模板适配：在消息行右键时打开上下文菜单。
 *
 * @param e - 鼠标事件。
 * @param messageId - 目标消息 id。
 * @returns void
 */
function handleMessageContextMenu(e: MouseEvent, messageId: string): void {
  openMenuForMessage(e, messageId);
}

/**
 * 模板适配：点击“⋯”按钮时打开上下文菜单。
 *
 * @param e - 点击事件。
 * @param messageId - 目标消息 id。
 * @returns void
 */
function handleMoreClick(e: MouseEvent, messageId: string): void {
  openMenuForMessage(e, messageId);
}

/**
 * 格式化消息气泡内的“引用预览”（from: snippet）。
 *
 * @param channelId - 当前频道 id。
 * @param replyToId - 被引用的消息 id。
 * @returns 简短的 `from: snippet` 文本；缺失/被删时返回 "—"。
 */
function formatReplyMiniText(channelId: string, replyToId: string): string {
  const r = getMessageById(channelId, replyToId);
  if (!r) return "—";
  const snippet = r.kind === "core_text" ? r.text : r.preview;
  return `${r.from.name}: ${snippet}`;
}

/**
 * 对当前选中的消息执行上下文菜单动作。
 *
 * @param action - 选择的菜单动作。
 * @returns Promise<void>
 */
async function handleMenuAction(action: MessageMenuAction): Promise<void> {
  const id = menuMessageId.value;
  if (!id) return;
  const msg = getMessageById(currentChannelId.value, id);
  if (!msg) return;

  if (action === "copy") {
    const text = msg.kind === "core_text" ? msg.text : msg.preview;
    await copyTextToClipboard(text);
    return;
  }
  if (action === "reply") {
    startReply(id);
    return;
  }
  if (action === "delete") {
    deleteMessage(id);
    return;
  }
  if (action === "forward") {
    const text = msg.kind === "core_text" ? msg.text : msg.preview;
    await copyTextToClipboard(text);
  }
}

/**
 * 从编辑器退出回复模式。
 */
function handleCancelReply(): void {
  cancelReply();
}

/**
 * 处理 Quick Switcher 的选中项。
 *
 * @param item - 选中的 quick switcher 条目。
 */
function handleQuickSelect(item: QuickSwitcherItem): void {
  if (item.kind === "route") {
    void router.push(item.id);
    closeQuickSwitcher();
    return;
  }
  if (item.kind === "server") {
    handleSwitchServer(item.id);
    closeQuickSwitcher();
    return;
  }
  if (item.kind === "channel") {
    const ch = findChannelById(item.id);
    if (ch && !ch.joined) {
      channelTab.value = "discover";
      channelSearch.value = ch.name;
      closeQuickSwitcher();
      return;
    }
    selectChannel(item.id);
    closeQuickSwitcher();
    return;
  }
  if (item.kind === "module") {
    void router.push({ path: "/plugins", query: { focus_plugin_id: item.id } });
    closeQuickSwitcher();
  }
}

/**
 * 全局按键处理（Patchbay 窗口）。
 *
 * 当前绑定：
 * - Ctrl/Cmd + K：打开 Quick Switcher。
 *
 * @param e - 键盘事件。
 * @returns void
 */
function onKeydown(e: KeyboardEvent): void {
  const key = e.key.toLowerCase();
  const meta = e.metaKey || e.ctrlKey;
  if (meta && key === "k") {
    e.preventDefault();
    openQuickSwitcher();
  }
}

/**
 * v-model 适配：更新 quick switcher 的打开状态。
 *
 * @param v - 是否应打开 quick switcher。
 * @returns void
 */
function setQuickOpen(v: boolean): void {
  quickSwitcherOpen.value = v;
}

/**
 * v-model 适配：更新 quick switcher 的查询串。
 *
 * @param v - 新的查询值。
 * @returns void
 */
function setQuickQuery(v: string): void {
  quickSwitcherQuery.value = v;
}

/**
 * v-model 适配：更新 quick switcher 的激活索引。
 *
 * @param v - 新的激活索引。
 * @returns void
 */
function setQuickActiveIndex(v: number): void {
  quickSwitcherActiveIndex.value = v;
}

/**
 * 监听源（watch）：quick switcher 的查询串。
 *
 * @returns 当前查询字符串。
 */
function watchQuickSwitcherQuery(): string {
  return quickSwitcherQuery.value;
}

/**
 * 当查询串变化时重置激活索引。
 *
 * @returns void
 */
function handleQuickSwitcherQueryChange(): void {
  quickSwitcherActiveIndex.value = 0;
}

watch(watchQuickSwitcherQuery, handleQuickSwitcherQueryChange);

/**
 * 在插件目录与安装状态刷新后，重新校验必需插件。
 *
 * @returns void
 */
function handlePluginStoresReady(): void {
  installStore.value.recheckRequired(requiredIds.value);
}

/**
 * 组件挂载：连接 + 预加载 store + 注册全局按键处理。
 *
 * @returns void
 */
function handleMounted(): void {
  if (String(route.query.welcome ?? "") === "new") {
    flashMessage.value = "Account created. Welcome.";
    void router.replace({ query: {} });
    window.setTimeout(() => {
      flashMessage.value = "";
    }, 2400);
  }

  attachPluginHostBridge();
  void connectWithRetry(socket.value).then(refreshServerInfo);
  void Promise.all([serverInfoStore.value.refresh(), catalogStore.value.refresh(), domainCatalogStore.value.refresh(), installStore.value.refreshInstalled()])
    .then(handlePluginStoresReady)
    .then(ensurePluginRuntime);
  void ensureChatReady();
  window.setTimeout(() => {
    const el = signalPaneRef.value;
    if (el) el.scrollTop = el.scrollHeight;
    maybeReportReadState();
  }, 0);
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("focus", handleWindowFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

onMounted(handleMounted);

/**
 * 组件卸载：移除全局监听器并清理插件 host bridge。
 *
 * @returns void
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("keydown", onKeydown);
  window.removeEventListener("focus", handleWindowFocus);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  domainRegistryStore.value.setHostBridge(null);
}

onBeforeUnmount(handleBeforeUnmount);
</script>

<template>
  <!-- 页面：MainPage｜职责：Patchbay 主窗口四栏布局 -->
  <!-- 区块：<main> .cp-main -->
  <main class="cp-main">
    <div v-if="flashMessage" class="cp-flash">{{ flashMessage }}</div>
    <!-- 区块：服务器栏（Server Rail） -->
    <aside class="cp-rail cp-rail--servers">
      <div class="cp-rail__title">RACKS</div>
      <div class="cp-rackList" role="listbox" aria-label="servers">
        <button
          v-for="s in serverRacks"
          :key="s.serverSocket"
          class="cp-rack"
          type="button"
          :data-active="s.serverSocket === socket"
          @click="handleSwitchServer(s.serverSocket)"
        >
          <span class="cp-rack__led" aria-hidden="true"></span>
          <span class="cp-rack__name">{{ s.name }}</span>
        </button>
      </div>
      <div class="cp-rail__foot">
        <button class="cp-rail__btn" type="button" @click="$router.push('/servers')">Servers</button>
        <button class="cp-rail__btn" type="button" @click="goPlugins">Modules</button>
        <button class="cp-rail__btn" type="button" @click="$router.push('/settings')">Settings</button>
      </div>
    </aside>

    <!-- 区块：频道栏（Channel Rail） -->
    <aside class="cp-rail cp-rail--channels">
      <!-- 区块：Patch Panel 头（服务器上下文 + gate 状态） -->
      <div class="cp-panelHead">
        <!-- 区块：标题 + 状态徽章 -->
        <div class="cp-panelHead__top">
          <div class="cp-panelHead__name">Patch Panel</div>
          <div class="cp-panelHead__badges">
            <LabelBadge v-if="missingRequiredCount > 0" variant="required" label="LATCH OPEN" />
            <LabelBadge v-else variant="info" label="READY" />
          </div>
        </div>
        <!-- 区块：服务器标识信息 -->
        <div class="cp-panelHead__socket">
          <MonoTag :value="socket || 'no-server'" title="server socket" :copyable="true" />
          <MonoTag :value="serverId || 'missing-server_id'" title="server_id" :copyable="true" />
        </div>
        <!-- 区块：主要动作按钮 -->
        <div class="cp-panelHead__actions">
          <button class="cp-panelHead__btn" type="button" @click="goPlugins">Plugin Center</button>
          <button v-if="missingRequiredCount > 0" class="cp-panelHead__btn danger" type="button" @click="$router.push('/required-setup')">
            Required Setup
          </button>
        </div>
      </div>

      <!-- 区块：频道搜索 + 已加入/发现 Tab -->
      <div class="cp-channelSearch">
        <!-- 区块：Tabs（joined/discover） -->
        <div class="cp-channelTabs">
          <button class="cp-channelTabs__btn" type="button" :data-active="channelTab === 'joined'" @click="channelTab = 'joined'">
            {{ t("channels_joined") }}
          </button>
          <button class="cp-channelTabs__btn" type="button" :data-active="channelTab === 'discover'" @click="channelTab = 'discover'">
            {{ t("channels_discover") }}
          </button>
          <button class="cp-channelTabs__btn add" type="button" @click="showCreateChannel = true" :title="t('create_channel')">+</button>
        </div>
        <!-- 区块：搜索输入框 -->
        <t-input v-model="channelSearch" :placeholder="t('channel_search_placeholder')" clearable />
      </div>

      <!-- 区块：频道列表（joined/discover） -->
      <div class="cp-channelList" role="listbox" aria-label="channels">
        <!-- 区块：空状态 -->
        <div v-if="channels.length === 0" class="cp-channelEmpty">
          {{ channelTab === "joined" ? t("channels_joined_empty") : t("channels_discover_empty") }}
        </div>
        <!-- 区块：频道行列表 -->
        <article v-for="c in channels" v-else :key="c.id" class="cp-channelRow" :data-active="c.id === currentChannelId">
          <!-- 区块：频道主入口（未加入时禁用） -->
          <button
            class="cp-channelRow__main"
            type="button"
            :disabled="!c.joined"
            @click="selectChannel(c.id)"
          >
            <span class="cp-channel__port" aria-hidden="true"></span>
            <span class="cp-channelRow__meta">
              <span class="cp-channel__name">{{ c.name }}</span>
              <span class="cp-channelRow__brief">{{ c.brief }}</span>
            </span>
          </button>

          <!-- 区块：右侧动作（未读/加入/信息） -->
          <div class="cp-channelRow__right">
            <span v-if="c.joined && c.unread > 0" class="cp-channel__unread">{{ c.unread }}</span>
            <button
              v-else-if="!c.joined"
              class="cp-channelRow__join"
              type="button"
              :disabled="c.joinRequested"
              @click="applyJoin(c.id)"
            >
              {{ c.joinRequested ? t("channel_join_request_sent") : t("apply_join") }}
            </button>
            <button class="cp-channelRow__info" type="button" @click="openChannelInfo(c.id)">{{ t("channel_info") }}</button>
          </div>
        </article>
      </div>
    </aside>

    <!-- 区块：消息区（Center） -->
    <section class="cp-center">
      <header class="cp-topConsole">
        <div class="cp-topConsole__left">
          <div class="cp-topConsole__title">SIGNAL FLOW</div>
          <div class="cp-topConsole__hint">Ctrl/Cmd+K</div>
        </div>
        <div class="cp-topConsole__right">
          <button v-if="currentChannelId" class="cp-topConsole__settings" type="button" @click="openChannelSettingsMenu" :title="t('channel_settings')">⚙</button>
          <ConnectionPill
            :state="connectionPillState"
            label="Link"
            :detail="connectionDetail"
            :action-label="connectionPillState === 'offline' ? 'Retry' : ''"
            @action="retryLast"
          />
        </div>
      </header>

      <div ref="signalPaneRef" class="cp-signalPane" role="log" aria-label="messages" @scroll="handleSignalScroll">
        <!-- 区块：游标分页（加载更早历史） -->
        <div v-if="currentChannelHasMore" class="cp-historyMore">
          <button
            class="cp-historyMore__btn"
            type="button"
            :disabled="loadingMoreMessages"
            @click="handleLoadMoreMessages"
          >
            {{ loadingMoreMessages ? t("loading") : t("load_older") }}
          </button>
        </div>

        <!-- 区块：消息列表（包含基于 last_read_time 的“UNREAD”分隔符，mock 逻辑） -->
        <template v-for="{ m, isGroupStart, isUnreadStart } in messageRows" :key="m.id">
          <!-- 区块：未读边界 -->
          <div v-if="isUnreadStart" class="cp-unreadSep" role="separator" aria-label="unread boundary">UNREAD</div>
          <!-- 区块：消息行 -->
          <div
            class="cp-msg"
            :data-mine="m.from.id === currentUserId"
            :data-group-start="isGroupStart"
            @contextmenu="handleMessageContextMenu($event, m.id)"
          >
            <!-- 区块：头像列（仅 group-start 可见；预留空间用于对齐） -->
            <div class="cp-msg__avatar" :data-visible="isGroupStart">
              <AvatarBadge :name="m.from.name" :size="28" />
            </div>
            <!-- 区块：domain 色条列 -->
            <div class="cp-msg__strip">
              <SignalStrip :color-var="m.domain.colorVar" />
            </div>
            <!-- 区块：内容列（meta + bubble/card） -->
            <div class="cp-msg__body">
              <!-- 区块：meta 行 -->
              <div class="cp-msg__meta" :data-compact="!isGroupStart">
                <span v-if="isGroupStart" class="cp-msg__from">{{ m.from.name }}</span>
                <span class="cp-msg__dot"></span>
                <span class="cp-msg__time">{{ fmtTime(m.timeMs) }}</span>
                <span class="cp-msg__dot"></span>
                <span class="cp-msg__domain">{{ m.domain.label }}</span>
                <button class="cp-msg__more" type="button" @click="handleMoreClick($event, m.id)">⋯</button>
              </div>

              <!-- 区块：核心文本气泡（Core:Text） -->
              <div v-if="m.kind === 'core_text'" class="cp-bubble">
                <!-- 区块：引用预览（安全降级：缺失/被删回退为 "—"） -->
                <div v-if="m.replyToId" class="cp-replyMini">
                  <div class="cp-replyMini__k">reply</div>
                  <div class="cp-replyMini__v">
                    {{ formatReplyMiniText(currentChannelId, m.replyToId) }}
                  </div>
                </div>
                <template v-if="hasFileToken(m.text)">
                  <template v-for="(p, idx) in parseCoreTextParts(m.text)" :key="`${m.id}-${idx}`">
                    <span v-if="p.kind === 'text'">{{ p.text }}</span>
                    <FileMessageBubble v-else :filename="p.shareKey" :share-key="p.shareKey" />
                  </template>
                </template>
                <template v-else>{{ m.text }}</template>
              </div>
              <!-- 区块：插件渲染（domain 已注册且存在 renderer 时） -->
              <div
                v-else-if="m.kind === 'domain_message' && domainRegistryStore.bindingByDomain[m.domain.id]?.renderer"
                class="cp-pluginBubble"
              >
                <component
                  :is="domainRegistryStore.bindingByDomain[m.domain.id].renderer"
                  :context="domainRegistryStore.getContextForDomain(m.domain.id)"
                  :data="m.data"
                  :preview="m.preview"
                  :domain="m.domain.id"
                  :domainVersion="m.domain.version || ''"
                  :mid="m.id"
                  :from="m.from"
                  :timeMs="m.timeMs"
                  :replyToMid="m.replyToId"
                />
              </div>
              <!-- 区块：未知 domain 降级卡片 -->
              <UnknownDomainCard
                v-else
                :domain-id="m.domain.id"
                :domain-version="m.domain.version || ''"
                :plugin-id-hint="m.domain.pluginIdHint || ''"
                :preview="m.preview"
                @install="handleInstallHint(m.domain.pluginIdHint)"
              />
            </div>
          </div>
        </template>

        <button
          v-if="showJumpToBottom"
          class="cp-jumpBottom"
          type="button"
          aria-label="Jump to bottom"
          title="Jump to bottom"
          @click="handleJumpToBottom"
        >
          ↓
        </button>
      </div>

      <div class="cp-composerPane">
        <div class="cp-composerActions">
          <FileUploadButton @uploaded="handleFileUploaded" @error="handleFileUploadError" />
        </div>
        <ComposerHost
          :domain-id="selectedDomainId"
          :domain-options="domainOptions"
          :draft="composerDraft"
          :reply-title="replyPreview.title"
          :reply-snippet="replyPreview.snippet"
          :reply-to-mid="replyToMessageId"
          :error="sendError"
          :plugin-composer="activePluginComposer"
          :plugin-context="activePluginContext"
          @update:domainId="setDomainId"
          @update:draft="setDraft"
          @send="sendComposerMessage"
          @cancelReply="handleCancelReply"
        />
      </div>
    </section>

    <!-- 区块：成员栏（Members Rail） -->
    <aside class="cp-rail cp-rail--members">
      <div class="cp-rail__title">PORTS</div>
      <div class="cp-memberList">
        <div v-for="u in members" :key="u.id" class="cp-member">
          <AvatarBadge :name="u.name" :size="28" />
          <div class="cp-member__meta">
            <div class="cp-member__name">{{ u.name }}</div>
            <div class="cp-member__role">{{ u.role }}</div>
          </div>
        </div>
      </div>
    </aside>

    <QuickSwitcher
      :open="quickSwitcherOpen"
      :query="quickSwitcherQuery"
      :items="qsItems"
      :active-index="quickSwitcherActiveIndex"
      @update:open="setQuickOpen"
      @update:query="setQuickQuery"
      @update:activeIndex="setQuickActiveIndex"
      @select="handleQuickSelect"
    />

    <MessageContextMenu
      :open="menuOpen"
      :x="menuX"
      :y="menuY"
      @close="closeMenu"
      @action="handleMenuAction"
    />

    <!-- 区块：频道设置菜单（Channel Settings Menu） -->
    <teleport to="body">
      <div v-if="showChannelMenu" class="cp-channelMenu" :style="{ left: `${channelMenuX}px`, top: `${channelMenuY}px` }" role="menu" @click.stop>
        <button class="cp-channelMenu__item" type="button" @click="openChannelMembers(currentChannelId); closeChannelMenu()">
          {{ t("channel_members") }}
        </button>
        <button class="cp-channelMenu__item" type="button" @click="openJoinApplications(currentChannelId); closeChannelMenu()">
          {{ t("join_applications") }}
        </button>
        <button class="cp-channelMenu__item" type="button" @click="openChannelBans(currentChannelId); closeChannelMenu()">
          {{ t("channel_bans") }}
        </button>
        <div class="cp-channelMenu__sep"></div>
        <button class="cp-channelMenu__item danger" type="button" @click="openDeleteChannelDialog">
          {{ t("delete_channel") }}
        </button>
      </div>
      <div v-if="showChannelMenu" class="cp-channelMenu__backdrop" @click="closeChannelMenu"></div>
    </teleport>

    <!-- 区块：创建频道弹窗（Create Channel Dialog） -->
    <CreateChannelDialog
      :visible="showCreateChannel"
      @update:visible="showCreateChannel = $event"
      @created="handleChannelCreated"
    />

    <!-- 区块：删除频道弹窗（Delete Channel Dialog） -->
    <DeleteChannelDialog
      :visible="showDeleteChannel"
      :channel-id="deleteChannelId"
      :channel-name="deleteChannelName"
      @update:visible="showDeleteChannel = $event"
      @deleted="handleChannelDeleted"
    />
  </main>
</template>

<style scoped lang="scss">
/* 样式：MainPage｜布局：四栏 Patchbay 网格（servers / channels / messages / members） */
.cp-main {
  height: 100%;
  display: grid;
  grid-template-columns: 180px 300px 1fr 240px;
  gap: 14px;
  padding: 14px;
  position: relative;
}

/* 区块：游标分页“加载更早历史”行 */
.cp-historyMore {
  padding: 10px 0 6px;
  display: flex;
  justify-content: center;
}

.cp-historyMore__btn {
  border: 1px dashed var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-historyMore__btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
}

.cp-historyMore__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 区块：闪现提示条（一次性，受 query 驱动） */
.cp-flash {
  position: absolute;
  left: 50%;
  top: 10px;
  transform: translateX(-50%);
  z-index: 20;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  box-shadow: var(--cp-shadow-soft);
  max-width: min(680px, 88vw);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 容器：共享的 rail/center 面板外壳 */
.cp-rail,
.cp-center {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  overflow: hidden;
  min-width: 0;
}

/* 栏（Rail）：基础布局（标题 / 可滚动主体 / 底部） */
.cp-rail {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

/* 栏（Rail）：频道栏额外包含搜索区 */
.cp-rail--channels {
  grid-template-rows: auto auto 1fr;
}

/* 栏（Rail）：成员栏无底部区 */
.cp-rail--members {
  grid-template-rows: auto 1fr;
}

/* 栏标题：大写标签 */
.cp-rail__title {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--cp-panel) 66%, transparent),
    transparent
  );
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 栏底部：纵向堆叠导航按钮 */
.cp-rail__foot {
  border-top: 1px solid var(--cp-border-light);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 栏按钮：胶囊形导航按钮 */
.cp-rail__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: color-mix(in oklab, var(--cp-text) 82%, transparent);
  border-radius: 999px;
  padding: 10px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 栏按钮：悬停态 */
.cp-rail__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
}

.cp-rail__btn:active {
  transform: translateY(0);
}

/* 服务器机架列表 */
.cp-rackList {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: auto;
}

/* 机架条目 */
.cp-rack {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: color-mix(in oklab, var(--cp-text) 82%, transparent);
  border-radius: 16px;
  padding: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 机架条目：悬停态 */
.cp-rack:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
}

.cp-rack:active {
  transform: translateY(0);
}

/* 机架条目：激活态 */
.cp-rack[data-active="true"] {
  border-color: color-mix(in oklab, var(--cp-info) 42%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 12%, var(--cp-panel));
}

/* 机架 LED 指示灯 */
.cp-rack__led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-accent) 16%, transparent);
}

/* 机架名称 */
.cp-rack__name {
  font-size: 12px;
  font-family: var(--cp-font-display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* 补丁面板（Patch Panel）头容器（频道栏头部） */
.cp-panelHead {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--cp-panel) 62%, transparent),
    transparent
  );
}

/* 补丁面板（Patch Panel）头：顶部行 */
.cp-panelHead__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

/* 补丁面板（Patch Panel）名称 */
.cp-panelHead__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: color-mix(in oklab, var(--cp-text) 96%, transparent);
}

/* 补丁面板（Patch Panel）徽章（READY/LATCH） */
.cp-panelHead__badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* 补丁面板（Patch Panel）socket 行 */
.cp-panelHead__socket {
  margin-top: 10px;
}

/* 补丁面板（Patch Panel）动作按钮行 */
.cp-panelHead__actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* 补丁面板（Patch Panel）动作按钮 */
.cp-panelHead__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 补丁面板（Patch Panel）动作按钮：悬停态 */
.cp-panelHead__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
}

.cp-panelHead__btn:active {
  transform: translateY(0);
}

/* 补丁面板（Patch Panel）危险动作按钮（Required Setup） */
.cp-panelHead__btn.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 32%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}

/* 补丁面板（Patch Panel）危险动作按钮：悬停态 */
.cp-panelHead__btn.danger:hover {
  border-color: rgba(239, 68, 68, 0.46);
  background: color-mix(in oklab, var(--cp-danger) 14%, var(--cp-hover-bg));
}

/* 频道栏：搜索 + Tabs 容器 */
.cp-channelSearch {
  padding: 12px 14px;
  border-bottom: 1px solid var(--cp-border-light);
}

/* 频道栏：Tabs 行 */
.cp-channelTabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

/* 频道 Tab 按钮 */
.cp-channelTabs__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

/* 频道 Tab 按钮：悬停态 */
.cp-channelTabs__btn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.cp-channelTabs__btn:active {
  transform: translateY(0);
}

/* 频道 Tab 按钮：激活态 */
.cp-channelTabs__btn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* 频道列表容器 */
.cp-channelList {
  padding: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 频道列表：空状态 */
.cp-channelEmpty {
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px dashed rgba(148, 163, 184, 0.26);
  background: var(--cp-panel-muted);
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}

/* 旧版频道按钮（保留用于后续重构对比） */
.cp-channel {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  color: color-mix(in oklab, var(--cp-text) 82%, transparent);
  border-radius: 16px;
  padding: 10px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 旧版频道按钮：悬停态 */
.cp-channel:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-highlight) 30%, var(--cp-border));
}

/* 旧版频道按钮：激活态 */
.cp-channel[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: color-mix(in oklab, var(--cp-highlight) 10%, var(--cp-panel));
}

/* 频道端口点（使用 highlight 颜色） */
.cp-channel__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-highlight);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-highlight) 14%, transparent);
}

/* 频道名称（单行省略） */
.cp-channel__name {
  font-size: 13px;
  color: color-mix(in oklab, var(--cp-text) 92%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 频道未读徽标（pill） */
.cp-channel__unread {
  min-width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  background: color-mix(in oklab, var(--cp-warn) 18%, transparent);
  border: 1px solid color-mix(in oklab, var(--cp-warn) 40%, var(--cp-border));
}

/* 频道行（joined/discover） */
.cp-channelRow {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

/* 频道行：激活态 */
.cp-channelRow[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: color-mix(in oklab, var(--cp-highlight) 10%, var(--cp-panel));
}

/* 频道行：主可点击区域 */
.cp-channelRow__main {
  border: none;
  background: transparent;
  padding: 0;
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

/* 频道行：未加入时禁用态 */
.cp-channelRow__main:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 频道行：meta（name + brief） */
.cp-channelRow__meta {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 频道行：brief（单行省略） */
.cp-channelRow__brief {
  font-size: 12px;
  color: color-mix(in oklab, var(--cp-text-muted) 88%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 频道行：右侧动作（unread/join/info） */
.cp-channelRow__right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

/* 频道行：加入/申请按钮 */
.cp-channelRow__join {
  border: 1px solid color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 10%, var(--cp-panel-muted));
  color: var(--cp-text);
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* 频道行：加入按钮悬停态 */
.cp-channelRow__join:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-channelRow__join:active {
  transform: translateY(0);
}

/* 频道行：信息快捷入口 */
.cp-channelRow__info {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 7px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease), color var(--cp-fast) var(--cp-ease);
}

/* 频道行：信息按钮悬停态 */
.cp-channelRow__info:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
  color: var(--cp-text);
}

.cp-channelRow__info:active {
  transform: translateY(0);
}

/* 频道行：加入按钮禁用态 */
.cp-channelRow__join:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* 中间栏布局（top console / messages / composer） */
.cp-center {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

/* 顶部控制台栏 */
.cp-topConsole {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--cp-panel) 60%, transparent),
    transparent
  );
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* 顶部控制台标题 */
.cp-topConsole__title {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 顶部控制台提示文本 */
.cp-topConsole__hint {
  margin-top: 6px;
  font-size: 12px;
  color: color-mix(in oklab, var(--cp-text-muted) 82%, transparent);
}

/* 消息面板：可滚动消息列表 */
.cp-signalPane {
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-jumpBottom {
  position: sticky;
  bottom: 12px;
  align-self: flex-end;
  z-index: 3;
  border: 1px solid var(--cp-border);
  background: color-mix(in oklab, var(--cp-panel) 92%, transparent);
  color: var(--cp-text);
  border-radius: 999px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: var(--cp-shadow-soft);
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

.cp-jumpBottom:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-jumpBottom:active {
  transform: translateY(0);
}

/* 未读分隔符 */
.cp-unreadSep {
  align-self: center;
  font-family: var(--cp-font-display);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px dashed rgba(148, 163, 184, 0.28);
  background: color-mix(in oklab, var(--cp-panel-muted) 88%, transparent);
}

/* 消息行网格（avatar / strip / body） */
.cp-msg {
  display: grid;
  grid-template-columns: 36px 2px 1fr;
  grid-template-areas: "avatar strip body";
  gap: 12px;
  align-items: start;
}

/* 消息行：mine 时翻转布局（右对齐） */
.cp-msg[data-mine="true"] {
  grid-template-columns: 1fr 2px 36px;
  grid-template-areas: "body strip avatar";
}

/* 消息行：头像槽位 */
.cp-msg__avatar {
  grid-area: avatar;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
}

/* 消息行：头像可见性（非 group-start 时隐藏但不压缩布局） */
.cp-msg__avatar[data-visible="false"] {
  visibility: hidden;
}

/* 消息行：domain 色条槽位 */
.cp-msg__strip {
  grid-area: strip;
}

/* 消息行：mine 时头像对齐 */
.cp-msg[data-mine="true"] .cp-msg__avatar {
  justify-content: flex-end;
}

/* 消息行：内容槽位 */
.cp-msg__body {
  grid-area: body;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

/* 消息行：mine 时内容对齐 */
.cp-msg[data-mine="true"] .cp-msg__body {
  align-items: flex-end;
}

/* 消息 meta 行（from/time/domain/more） */
.cp-msg__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
  line-height: 16px;
  color: color-mix(in oklab, var(--cp-text-muted) 96%, transparent);
  margin-bottom: 8px;
  width: 100%;
}

/* 元信息（meta）：分组消息的紧凑变体 */
.cp-msg__meta[data-compact="true"] {
  margin-bottom: 6px;
  opacity: 0.82;
}

/* 元信息（meta）：发送者名称 */
.cp-msg__from {
  font-family: var(--cp-font-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: color-mix(in oklab, var(--cp-text) 92%, transparent);
}

/* 元信息（meta）：时间戳 + domain（等宽字体） */
.cp-msg__time,
.cp-msg__domain {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: color-mix(in oklab, var(--cp-text-muted) 96%, transparent);
}

/* 元信息（meta）：点分隔符 */
.cp-msg__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

/* 单条消息的“更多”按钮（打开上下文菜单） */
.cp-msg__more {
  margin-left: auto;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: 10px;
  padding: 4px 8px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

/* “更多”按钮：悬停态 */
.cp-msg__more:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
}

.cp-msg__more:active {
  transform: translateY(0);
}

/* 核心文本气泡 */
.cp-bubble {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 12px;
  color: color-mix(in oklab, var(--cp-text) 90%, transparent);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--cp-shadow-soft);
  max-width: min(74ch, 100%);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* 插件渲染气泡（外壳同核心气泡；内部 UI 由插件定义） */
.cp-pluginBubble {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 10px;
  box-shadow: var(--cp-shadow-soft);
  max-width: min(74ch, 100%);
}

/* 插件气泡：mine 强调色 */
.cp-msg[data-mine="true"] .cp-pluginBubble {
  border-color: color-mix(in oklab, var(--cp-accent) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel));
}

/* 核心文本气泡：mine 强调色 */
.cp-msg[data-mine="true"] .cp-bubble {
  border-color: color-mix(in oklab, var(--cp-accent) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel));
}

/* 气泡内的引用预览 */
.cp-replyMini {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid var(--cp-border-light);
  background: var(--cp-panel-muted);
  display: flex;
  align-items: baseline;
  gap: 10px;
}

/* 引用预览：标签 */
.cp-replyMini__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* 引用预览：内容 */
.cp-replyMini__v {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

/* 编辑器面板容器 */
.cp-composerPane {
  border-top: 1px solid var(--cp-border-light);
  padding: 12px;
}

/* 成员列表 */
.cp-memberList {
  padding: 12px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 成员行 */
.cp-member {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 10px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  align-items: center;
}

/* 成员端口点 */
.cp-member__port {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.62);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
}

/* 成员名称（省略） */
.cp-member__name {
  font-size: 13px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 成员角色标签 */
.cp-member__role {
  margin-top: 4px;
  font-family: var(--cp-font-mono);
  font-size: 11px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* 标签页（Tabs）中的“创建频道”按钮 */
.cp-channelTabs__btn.add {
  margin-left: auto;
  font-size: 16px;
  font-weight: bold;
  min-width: 32px;
  padding: 6px 10px;
}

/* 顶部控制台“设置”按钮 */
.cp-topConsole__settings {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
  margin-right: 10px;
}

.cp-topConsole__settings:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-topConsole__settings:active {
  transform: translateY(0);
}

/* 编辑器动作行 */
.cp-composerActions {
  margin-bottom: 10px;
  display: flex;
  gap: 10px;
}

/* 频道设置菜单 */
.cp-channelMenu {
  position: fixed;
  z-index: 60;
  min-width: 180px;
  border: 1px solid color-mix(in oklab, var(--cp-info) 18%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-panel) 92%, rgba(0, 0, 0, 0.05));
  border-radius: 16px;
  box-shadow: var(--cp-shadow);
  padding: 8px;
  backdrop-filter: blur(10px);
}

.cp-channelMenu__backdrop {
  position: fixed;
  z-index: 59;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.cp-channelMenu__item {
  width: 100%;
  display: flex;
  justify-content: flex-start;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-channelMenu__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
}

.cp-channelMenu__item:active {
  transform: translateY(0);
}
.cp-channelMenu__sep {
  margin: 6px 6px;
  height: 1px;
  background: var(--cp-border-light);
}

.cp-channelMenu__item.danger {
  color: color-mix(in oklab, var(--cp-danger) 72%, var(--cp-text));
}

.cp-channelMenu__item.danger:hover {
  border-color: color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-hover-bg));
}
</style>
