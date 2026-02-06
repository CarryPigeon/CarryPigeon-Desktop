<script setup lang="ts">
/**
 * @fileoverview 聊天主页面（Patchbay 主窗口）
 * @description 路由 `/chat` 的主窗口：机架（服务器）/频道/消息流/编辑器/成员列表。
 */

import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { connectWithRetry } from "@/features/network/api";
import {
  createDomainCatalogContext,
  createPluginContext,
  type PluginComposerPayload,
  useDomainRegistryStore,
} from "@/features/plugins/api";
import { serverRacks, setServerSocket, useCurrentServerContext } from "@/features/servers/api";
import ServerRail from "@/features/chat/presentation/components/ServerRail.vue";
import ChannelRail from "@/features/chat/presentation/components/ChannelRail.vue";
import MembersRail from "@/features/chat/presentation/components/MembersRail.vue";
import ChannelSettingsMenu from "@/features/chat/presentation/components/ChannelSettingsMenu.vue";
import ChatCenter from "@/features/chat/presentation/components/ChatCenter.vue";
import { useChannelNavigation } from "@/features/chat/presentation/composables/useChannelNavigation";
import { usePatchbayLifecycle } from "@/features/chat/presentation/composables/usePatchbayLifecycle";
import {
  channels,
  allChannels,
  channelSearch,
  channelTab,
  currentChannelId,
  currentMessages,
  currentChannelHasMore,
  loadingMoreMessages,
  getMessageById,
  ensureChatReady,
  selectChannel,
  reportCurrentReadState,
  startReply,
  deleteMessage,
  loadMoreMessages,
  sendComposerMessage,
} from "@/features/chat/presentation/store/chatStore";
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
import CreateChannelDialog from "@/features/chat/presentation/components/CreateChannelDialog.vue";
import DeleteChannelDialog from "@/features/chat/presentation/components/DeleteChannelDialog.vue";

const router = useRouter();
const route = useRoute();
const {
  findChannelById,
  openChannelInfo,
  openChannelMembers,
  openJoinApplications,
  openChannelBans,
} = useChannelNavigation();
const flashMessage = ref<string>("");
const signalPaneRef = ref<HTMLElement | null>(null);

/**
 * 由子组件回传 signal pane DOM 引用，供滚动定位与读状态上报使用。
 *
 * @param el - 消息面板元素。
 */
function setSignalPaneRef(el: HTMLElement | null): void {
  signalPaneRef.value = el;
}
let autoLoadCooldown = 0;
let pendingScrollToBottom = false;
const showJumpToBottom = ref(false);

const { socket, serverInfoStore, serverId, refreshServerInfo } = useCurrentServerContext();
const requiredPluginsDeclared = computed(() => serverInfoStore.value.info.value?.requiredPlugins ?? null);
const {
  catalogStore,
  installStore,
  requiredIds,
  refreshCatalog,
  refreshInstalled,
} = createPluginContext({ socket, requiredPluginsDeclared });
const { refreshDomainCatalog } = createDomainCatalogContext(socket);

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
 * 将 host bridge 注入到 domain registry，使插件能够发送消息。
 *
 * 设计目的：避免 registry 直接 import chat store（防止循环依赖）。
 *
 * @returns 无返回值。
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
 * 跳转到插件中心；当缺少必需模块时，默认切到“required”过滤器。
 */
function goPlugins(): void {
  void router.push({ path: "/plugins", query: missingRequiredCount.value > 0 ? { filter: "required" } : {} });
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
 * 加载更早一页消息，同时保持滚动位置稳定。
 *
 * 目的：在头部 prepend 历史消息时避免列表“跳动”。
 *
 * @returns 无返回值。
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
 * @returns 无返回值。
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
 * @returns 无返回值。
 */
function maybeReportReadState(): void {
  if (!isSignalAtBottom()) return;
  void reportCurrentReadState();
}

/**
 * 将消息面板滚动到底部，并隐藏“跳到底部”的入口。
 *
 * @returns 无返回值。
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
 * @returns 无返回值。
 */
function handleJumpToBottom(): void {
  scrollSignalToBottom();
  maybeReportReadState();
}

/**
 * 窗口聚焦处理：当用户返回且处于底部时，尽力标记为已读。
 *
 * @returns 无返回值。
 */
function handleWindowFocus(): void {
  maybeReportReadState();
}

/**
 * 页面可见性处理：从后台切回可见时，尽力标记为已读。
 *
 * @returns 无返回值。
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
 * @returns 无返回值。
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
 * @param s - 目标服务器 Socket 地址。
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
 * 键盘快捷：在聚焦消息时进入回复态。
 *
 * @param messageId - 目标消息 id。
 * @returns 无返回值。
 */
function handleReplyShortcut(messageId: string): void {
  startReply(messageId);
}

/**
 * 键盘快捷：在聚焦消息时删除消息（由 store 内部做权限校验）。
 *
 * @param messageId - 目标消息 id。
 * @returns 无返回值。
 */
function handleDeleteShortcut(messageId: string): void {
  deleteMessage(messageId);
}

/**
 * 确保已启用的插件运行时被加载（用于消息渲染/编辑器插件能力）。
 *
 * @returns 无返回值。
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
 * @returns 无返回值。
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
 * @returns 无返回值。
 */
function closeMenu(): void {
  menuOpen.value = false;
}

/**
 * 模板适配：在消息行右键时打开上下文菜单。
 *
 * @param e - 鼠标事件。
 * @param messageId - 目标消息 id。
 * @returns 无返回值。
 */
function handleMessageContextMenu(e: MouseEvent, messageId: string): void {
  openMenuForMessage(e, messageId);
}

/**
 * 模板适配：点击“⋯”按钮时打开上下文菜单。
 *
 * @param e - 点击事件。
 * @param messageId - 目标消息 id。
 * @returns 无返回值。
 */
function handleMoreClick(e: MouseEvent, messageId: string): void {
  openMenuForMessage(e, messageId);
}

/**
 * 对当前选中的消息执行上下文菜单动作。
 *
 * @param action - 选择的菜单动作。
 * @returns 无返回值。
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
 * @returns 无返回值。
 */
function onKeydown(e: KeyboardEvent): void {
  const key = e.key.toLowerCase();
  const meta = e.metaKey || e.ctrlKey;

  if (e.key === "Escape") {
    if (quickSwitcherOpen.value) closeQuickSwitcher();
    if (menuOpen.value) closeMenu();
    if (showChannelMenu.value) closeChannelMenu();
    if (showCreateChannel.value) showCreateChannel.value = false;
    if (showDeleteChannel.value) showDeleteChannel.value = false;
    return;
  }

  if (meta && key === "k") {
    e.preventDefault();
    openQuickSwitcher();
    return;
  }

  if (meta && key === "p") {
    e.preventDefault();
    goPlugins();
    return;
  }

  if (meta && key === ",") {
    e.preventDefault();
    void router.push("/settings");
  }
}

/**
 * v-model 适配：更新 quick switcher 的打开状态。
 *
 * @param v - 是否应打开 quick switcher。
 * @returns 无返回值。
 */
function setQuickOpen(v: boolean): void {
  quickSwitcherOpen.value = v;
}

/**
 * v-model 适配：更新 quick switcher 的查询串。
 *
 * @param v - 新的查询值。
 * @returns 无返回值。
 */
function setQuickQuery(v: string): void {
  quickSwitcherQuery.value = v;
}

/**
 * v-model 适配：更新 quick switcher 的激活索引。
 *
 * @param v - 新的激活索引。
 * @returns 无返回值。
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
 * @returns 无返回值。
 */
function handleQuickSwitcherQueryChange(): void {
  quickSwitcherActiveIndex.value = 0;
}

watch(watchQuickSwitcherQuery, handleQuickSwitcherQueryChange);

/**
 * 在插件目录与安装状态刷新后，重新校验必需插件。
 *
 * @returns 无返回值。
 */
function handlePluginStoresReady(): void {
  installStore.value.recheckRequired(requiredIds.value);
}

/**
 * 将挂载/卸载副作用收敛到一个 composable，避免拆组件时遗漏清理。
 */
usePatchbayLifecycle({
  route,
  router,
  flashMessage,
  socket,
  attachPluginHostBridge,
  connect: connectWithRetry,
  refreshStores: () => Promise.all([refreshServerInfo(), refreshCatalog(), refreshDomainCatalog(), refreshInstalled()]).then(() => void 0),
  afterPluginStoresReady: handlePluginStoresReady,
  ensurePluginRuntime,
  ensureChatReady,
  signalPaneRef,
  maybeReportReadState,
  onKeydown,
  onWindowFocus: handleWindowFocus,
  onVisibilityChange: handleVisibilityChange,
  dispose: () => domainRegistryStore.value.setHostBridge(null),
});
</script>

<template>
  <!-- 页面：MainPage｜职责：Patchbay 主窗口四栏布局 -->
  <!-- 区块：<main> .cp-main -->
  <main class="cp-main">
    <div v-if="flashMessage" class="cp-flash">{{ flashMessage }}</div>
    <ServerRail
      :racks="serverRacks"
      :active-socket="socket"
      @switch="handleSwitchServer"
      @open-servers="$router.push('/servers')"
      @open-plugins="goPlugins"
      @open-settings="$router.push('/settings')"
    />

    <ChannelRail
      :socket="socket"
      :server-id="serverId"
      :missing-required-count="missingRequiredCount"
      @open-plugins="goPlugins"
      @open-required-setup="$router.push('/required-setup')"
      @open-create-channel="showCreateChannel = true"
      @open-channel-info="openChannelInfo"
    />

    <ChatCenter
      :show-jump-to-bottom="showJumpToBottom"
      :on-jump-to-bottom="handleJumpToBottom"
      :on-signal-scroll="handleSignalScroll"
      :on-load-more-messages="handleLoadMoreMessages"
      :register-signal-pane="setSignalPaneRef"
      :on-open-channel-settings-menu="openChannelSettingsMenu"
      :on-message-context-menu="handleMessageContextMenu"
      :on-more-click="handleMoreClick"
      :on-install-hint="handleInstallHint"
      :on-reply-shortcut="handleReplyShortcut"
      :on-delete-shortcut="handleDeleteShortcut"
      :domain-registry-store="domainRegistryStore"
    />

    <MembersRail />

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

    <ChannelSettingsMenu
      :open="showChannelMenu"
      :x="channelMenuX"
      :y="channelMenuY"
      @close="closeChannelMenu"
      @members="openChannelMembers(currentChannelId)"
      @applications="openJoinApplications(currentChannelId)"
      @bans="openChannelBans(currentChannelId)"
      @delete="openDeleteChannelDialog"
    />

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
