<script setup lang="ts">
/**
 * @fileoverview 聊天主页面（Patchbay 主窗口）
 * @description 路由 `/chat` 的主窗口：机架（服务器）/频道/消息流/编辑器/成员列表。
 */

import ServerRail from "@/features/chat/presentation/patchbay/components/layout/ServerRail.vue";
import ChannelRail from "@/features/chat/presentation/patchbay/components/layout/ChannelRail.vue";
import MembersRail from "@/features/chat/presentation/patchbay/components/layout/MembersRail.vue";
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from "vue";
import ChannelSettingsMenu from "@/features/chat/presentation/patchbay/components/menus/ChannelSettingsMenu.vue";
import ChatCenter from "@/features/chat/presentation/patchbay/components/layout/ChatCenter.vue";
import ThreadPanel from "@/features/chat/presentation/patchbay/components/thread/ThreadPanel.vue";
import { usePatchbayPageModel } from "@/features/chat/presentation/patchbay/page/usePatchbayPageModel";
import MessageContextMenu from "@/features/chat/presentation/patchbay/components/menus/MessageContextMenu.vue";
import CreateChatMenu from "@/features/chat/presentation/patchbay/components/menus/CreateChatMenu.vue";
import QuickSwitcher from "@/features/chat/presentation/patchbay/components/overlay/QuickSwitcher.vue";
import CreateChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/CreateChannelDialog.vue";
import CreateFriendPrivateChatDialog from "@/features/chat/presentation/patchbay/components/dialogs/CreateFriendPrivateChatDialog.vue";
import DeleteChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/DeleteChannelDialog.vue";
import "@/features/chat/public/styles";

const page = usePatchbayPageModel();

const mainEl = ref<HTMLElement | null>(null);
const activeResizer = ref<"server-channel" | "channel-message" | "message-members" | null>(null);
const serverWidth = ref(180);
const channelWidth = ref(300);
const membersWidth = ref(240);
const preferredServerWidth = ref(serverWidth.value);
const preferredChannelWidth = ref(channelWidth.value);
const preferredMembersWidth = ref(membersWidth.value);
let activeResizeCleanup: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let resizeFrame = 0;

const layoutMetrics = {
  horizontalPadding: 14,
  resizers: 24,
  gaps: 36,
  messageMin: 240,
} as const;

const railBounds = {
  server: { min: 96, max: 320 },
  channel: { min: 220, max: 520 },
  members: { min: 160, max: 380 },
} as const;

const mainStyle = computed(() => ({
  "--cp-server-rail-width": `${serverWidth.value}px`,
  "--cp-channel-rail-width": `${channelWidth.value}px`,
  "--cp-members-rail-width": `${membersWidth.value}px`,
}));

function clampWidth(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function growWidthToPreferred(width: Ref<number>, preferredWidth: Ref<number>, maxWidth: number, remainingSpace: number): number {
  const growth = Math.max(0, Math.min(remainingSpace, preferredWidth.value - width.value, maxWidth - width.value));
  width.value += growth;
  return remainingSpace - growth;
}

function resizePair(leftStart: number, rightStart: number, leftMin: number, rightMin: number, leftMax: number, rightMax: number, delta: number): [number, number] {
  const pairWidth = leftStart + rightStart;
  const nextLeft = clampWidth(leftStart + delta, leftMin, Math.min(leftMax, pairWidth - rightMin));
  const nextRight = clampWidth(pairWidth - nextLeft, rightMin, rightMax);
  return [pairWidth - nextRight, nextRight];
}

function resizeByDelta(kind: "server-channel" | "channel-message" | "message-members", delta: number): void {
  applyResizeDelta(kind, serverWidth.value, channelWidth.value, membersWidth.value, delta);
}

function applyResizeDelta(
  kind: "server-channel" | "channel-message" | "message-members",
  startServerWidth: number,
  startChannelWidth: number,
  startMembersWidth: number,
  delta: number,
): void {
  if (kind === "server-channel") {
    const [nextServerWidth, nextChannelWidth] = resizePair(
      startServerWidth,
      startChannelWidth,
      railBounds.server.min,
      railBounds.channel.min,
      railBounds.server.max,
      railBounds.channel.max,
      delta,
    );
    serverWidth.value = nextServerWidth;
    channelWidth.value = nextChannelWidth;
    preferredServerWidth.value = nextServerWidth;
    preferredChannelWidth.value = nextChannelWidth;
    if (mainEl.value) fitSideRailsToContainer(mainEl.value.getBoundingClientRect().width);
    return;
  }

  if (kind === "channel-message") {
    channelWidth.value = clampWidth(startChannelWidth + delta, railBounds.channel.min, railBounds.channel.max);
    preferredChannelWidth.value = channelWidth.value;
    if (mainEl.value) fitSideRailsToContainer(mainEl.value.getBoundingClientRect().width);
    return;
  }

  membersWidth.value = clampWidth(startMembersWidth - delta, railBounds.members.min, railBounds.members.max);
  preferredMembersWidth.value = membersWidth.value;
  if (mainEl.value) fitSideRailsToContainer(mainEl.value.getBoundingClientRect().width);
}

function sideRailBudget(containerWidth: number): number {
  return Math.max(
    railBounds.server.min + railBounds.channel.min + railBounds.members.min,
    containerWidth - layoutMetrics.horizontalPadding - layoutMetrics.resizers - layoutMetrics.gaps - layoutMetrics.messageMin,
  );
}

function fitSideRailsToContainer(containerWidth: number): void {
  const budget = sideRailBudget(containerWidth);
  const totalWidth = serverWidth.value + channelWidth.value + membersWidth.value;
  let overflow = totalWidth - budget;

  if (overflow <= 0) {
    let spareSpace = budget - totalWidth;
    spareSpace = growWidthToPreferred(membersWidth, preferredMembersWidth, railBounds.members.max, spareSpace);
    spareSpace = growWidthToPreferred(channelWidth, preferredChannelWidth, railBounds.channel.max, spareSpace);
    growWidthToPreferred(serverWidth, preferredServerWidth, railBounds.server.max, spareSpace);
    return;
  }

  const shrinkMembers = Math.min(overflow, membersWidth.value - railBounds.members.min);
  membersWidth.value -= shrinkMembers;
  overflow -= shrinkMembers;
  if (overflow <= 0) return;

  const shrinkChannel = Math.min(overflow, channelWidth.value - railBounds.channel.min);
  channelWidth.value -= shrinkChannel;
  overflow -= shrinkChannel;
  if (overflow <= 0) return;

  const shrinkServer = Math.min(overflow, serverWidth.value - railBounds.server.min);
  serverWidth.value -= shrinkServer;
}

function fitSideRailsToViewport(): void {
  if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    const mainWidth = mainEl.value?.getBoundingClientRect().width ?? document.documentElement.clientWidth;
    fitSideRailsToContainer(Math.min(mainWidth, document.documentElement.clientWidth));
  });
}

function handleResizeKeydown(kind: "server-channel" | "channel-message" | "message-members", event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  resizeByDelta(kind, event.key === "ArrowRight" ? 16 : -16);
}

function startResize(kind: "server-channel" | "channel-message" | "message-members", event: PointerEvent): void {
  event.preventDefault();
  activeResizeCleanup?.();
  const handle = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  handle?.setPointerCapture(event.pointerId);
  activeResizer.value = kind;
  const startX = event.clientX;
  const startServerWidth = serverWidth.value;
  const startChannelWidth = channelWidth.value;
  const startMembersWidth = membersWidth.value;

  document.body.classList.add("cp-is-resizing");

  const handlePointerMove = (moveEvent: PointerEvent): void => {
    const delta = moveEvent.clientX - startX;
    applyResizeDelta(kind, startServerWidth, startChannelWidth, startMembersWidth, delta);
  };

  const stopResize = (): void => {
    activeResizer.value = null;
    activeResizeCleanup = null;
    document.body.classList.remove("cp-is-resizing");
    if (handle?.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
  };

  activeResizeCleanup = stopResize;

  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", stopResize, { once: true });
  window.addEventListener("pointercancel", stopResize, { once: true });
}

onMounted(() => {
  resizeObserver = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width;
    if (typeof width === "number") fitSideRailsToContainer(Math.min(width, document.documentElement.clientWidth));
  });
  if (mainEl.value) resizeObserver.observe(mainEl.value);
  window.addEventListener("resize", fitSideRailsToViewport);
  fitSideRailsToViewport();
});

onBeforeUnmount(() => {
  activeResizeCleanup?.();
  resizeObserver?.disconnect();
  window.removeEventListener("resize", fitSideRailsToViewport);
  if (resizeFrame !== 0) cancelAnimationFrame(resizeFrame);
});
</script>

<template>
  <!-- 页面：MainPage｜职责：Patchbay 主窗口四栏布局 -->
  <!-- 区块：<main> .cp-main -->
  <main ref="mainEl" class="cp-main" :style="mainStyle">
    <div v-if="page.flashMessage" class="cp-flash">{{ page.flashMessage }}</div>
    <ServerRail
      :racks="page.serverRail.racks"
      :active-socket="page.serverRail.activeSocket"
      @switch="page.serverRail.handleSwitchServer"
      @open-servers="page.serverRail.handleOpenServers"
      @open-plugins="page.serverRail.goPlugins"
      @open-settings="page.serverRail.handleOpenSettings"
      @open-files="page.serverRail.handleOpenFiles"
    />

    <button
      class="cp-resizer"
      :data-active="activeResizer === 'server-channel'"
      type="button"
      role="separator"
      aria-label="Resize servers and channels"
      aria-orientation="vertical"
      :aria-valuemin="railBounds.server.min"
      :aria-valuemax="railBounds.server.max"
      :aria-valuenow="serverWidth"
      @pointerdown="startResize('server-channel', $event)"
      @keydown="handleResizeKeydown('server-channel', $event)"
    ></button>

    <ChannelRail :model="page.channelRail" />

    <button
      class="cp-resizer"
      :data-active="activeResizer === 'channel-message'"
      type="button"
      role="separator"
      aria-label="Resize channels and messages"
      aria-orientation="vertical"
      :aria-valuemin="railBounds.channel.min"
      :aria-valuemax="railBounds.channel.max"
      :aria-valuenow="channelWidth"
      @pointerdown="startResize('channel-message', $event)"
      @keydown="handleResizeKeydown('channel-message', $event)"
    ></button>

    <ChatCenter
      :model="page.chatCenter"
      :channels="page.channels"
      :show-jump-to-bottom="page.chatViewport.showJumpToBottom"
      :on-jump-to-bottom="page.chatViewport.handleJumpToBottom"
      :on-signal-scroll="page.chatViewport.handleSignalScroll"
      :register-signal-pane="page.chatViewport.setSignalPaneRef"
      :on-open-channel-settings-menu="page.chatViewport.openChannelSettingsMenu"
      :on-message-context-menu="page.chatViewport.handleMessageContextMenu"
      :on-more-click="page.chatViewport.handleMoreClick"
      :on-install-hint="page.chatViewport.handleInstallHint"
      :editing-message-id="page.editingMessageId"
      :on-edit="page.handleEditMessage"
      :on-edit-cancel="page.clearEditingMessageId"
      :on-view-thread="(messageId: string) => page.threadPanel.openThread(messageId)"
    />

    <button
      class="cp-resizer"
      :data-active="activeResizer === 'message-members'"
      type="button"
      role="separator"
      aria-label="Resize messages and members"
      aria-orientation="vertical"
      :aria-valuemin="railBounds.members.min"
      :aria-valuemax="railBounds.members.max"
      :aria-valuenow="membersWidth"
      @pointerdown="startResize('message-members', $event)"
      @keydown="handleResizeKeydown('message-members', $event)"
    ></button>

    <MembersRail :model="page.membersRail" />

    <QuickSwitcher
      :open="page.quickSwitcher.open"
      :query="page.quickSwitcher.query"
      :items="page.quickSwitcher.items"
      :active-index="page.quickSwitcher.activeIndex"
      @update:open="page.quickSwitcher.setOpen"
      @update:query="page.quickSwitcher.setQuery"
      @update:activeIndex="page.quickSwitcher.setActiveIndex"
      @select="page.quickSwitcher.handleSelect"
    />

    <MessageContextMenu
      :open="page.messageContextMenu.open"
      :x="page.messageContextMenu.x"
      :y="page.messageContextMenu.y"
      :show-recall="page.messageContextMenu.showRecall"
      :show-view-thread="page.messageContextMenu.showViewThread"
      @close="page.messageContextMenu.close"
      @action="page.messageContextMenu.handleMenuCommand"
    />

    <ChannelSettingsMenu
      :open="page.channelSettingsMenu.open"
      :x="page.channelSettingsMenu.x"
      :y="page.channelSettingsMenu.y"
      @close="page.channelSettingsMenu.close"
      @members="page.channelSettingsMenu.openMembers(page.chatCenter.currentChannelId)"
      @applications="page.channelSettingsMenu.openJoinApplications(page.chatCenter.currentChannelId)"
      @bans="page.channelSettingsMenu.openChannelBans(page.chatCenter.currentChannelId)"
      @delete="page.channelSettingsMenu.openDeleteChannelDialog"
    />

    <CreateChatMenu
      :open="page.channelDialogs.showCreateChatMenu"
      :x="page.channelDialogs.createChatMenuX"
      :y="page.channelDialogs.createChatMenuY"
      @close="page.channelDialogs.closeCreateChatMenu"
      @group="page.channelDialogs.openCreateChannelDialog"
      @private="page.channelDialogs.openCreateFriendPrivateChatDialog"
    />

    <!-- 区块：创建频道弹窗（Create Channel Dialog） -->
    <CreateChannelDialog
      :visible="page.channelDialogs.showCreateChannel"
      @update:visible="page.channelDialogs.setShowCreateChannel($event)"
      @created="page.channelDialogs.handleChannelCreated"
    />

    <!-- 区块：创建好友私聊弹窗（Create Friend Private Chat Dialog） -->
    <CreateFriendPrivateChatDialog
      :visible="page.channelDialogs.showCreateFriendPrivateChat"
      @update:visible="page.channelDialogs.setShowCreateFriendPrivateChat($event)"
    />

    <!-- 区块：删除频道弹窗（Delete Channel Dialog） -->
    <DeleteChannelDialog
      :visible="page.channelDialogs.showDeleteChannel"
      :channel-id="page.channelDialogs.deleteChannelId"
      :channel-name="page.channelDialogs.deleteChannelName"
      @update:visible="page.channelDialogs.setShowDeleteChannel($event)"
      @deleted="page.channelDialogs.handleChannelDeleted"
    />

    <ThreadPanel
      :model="page.threadPanel"
      :domain-registry-store="page.domainRegistryStore"
      @close="page.threadPanel.closeThread()"
    />
  </main>
</template>
