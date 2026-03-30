/**
 * @fileoverview patchbay page sections
 * @description
 * 收敛 Patchbay 页面各局部 section 的类型与构造函数，避免页面 composition root 挤入过多样板装配细节。
 */

import { proxyRefs, type ShallowUnwrapRef } from "vue";
import type { ComputedRef, Ref } from "vue";
import type { QuickSwitcherItem } from "@/features/chat/presentation/patchbay/state/quickSwitcherTypes";

type RefLike<T> = Ref<T> | ComputedRef<T>;

type PatchbayServerRailRawModel = {
  racks: RefLike<readonly { serverSocket: string; name: string }[]>;
  activeSocket: RefLike<string>;
  handleSwitchServer(serverSocket: string): void;
  handleOpenServers(): void;
  handleOpenSettings(): void;
  goPlugins(): void;
};
/**
 * Patchbay 页面服务器侧栏 section model。
 */
export type PatchbayServerRailModel = ShallowUnwrapRef<PatchbayServerRailRawModel>;

type PatchbayChatViewportRawModel = {
  showJumpToBottom: RefLike<boolean>;
  setSignalPaneRef(el: HTMLElement | null): void;
  handleJumpToBottom(): void;
  handleSignalScroll(): void;
  openChannelSettingsMenu(e: MouseEvent): void;
  handleMessageContextMenu(e: MouseEvent, messageId: string): void;
  handleMoreClick(e: MouseEvent, messageId: string): void;
  handleInstallHint(pluginId: string | undefined): void;
};
/**
 * Patchbay 页面聊天视口 section model。
 */
export type PatchbayChatViewportModel = ShallowUnwrapRef<PatchbayChatViewportRawModel>;

type PatchbayMessageContextMenuRawModel = {
  open: RefLike<boolean>;
  x: RefLike<number>;
  y: RefLike<number>;
  close(): void;
  handleAction(action: "copy" | "reply" | "delete" | "forward"): void;
};
/**
 * Patchbay 页面消息右键菜单 section model。
 */
export type PatchbayMessageContextMenuModel = ShallowUnwrapRef<PatchbayMessageContextMenuRawModel>;

type PatchbayChannelSettingsMenuRawModel = {
  open: RefLike<boolean>;
  x: RefLike<number>;
  y: RefLike<number>;
  close(): void;
  openMembers(channelId: string): void;
  openJoinApplications(channelId: string): void;
  openChannelBans(channelId: string): void;
  openDeleteChannelDialog(): void;
};
/**
 * Patchbay 页面频道设置菜单 section model。
 */
export type PatchbayChannelSettingsMenuModel = ShallowUnwrapRef<PatchbayChannelSettingsMenuRawModel>;

type PatchbayChannelDialogsRawModel = {
  showCreateChannel: RefLike<boolean>;
  showDeleteChannel: RefLike<boolean>;
  deleteChannelId: RefLike<string>;
  deleteChannelName: RefLike<string>;
  setShowCreateChannel(visible: boolean): void;
  setShowDeleteChannel(visible: boolean): void;
  handleChannelCreated(channel: { id: string; name: string }): void;
  handleChannelDeleted(): void;
};
/**
 * Patchbay 页面频道弹窗 section model。
 */
export type PatchbayChannelDialogsModel = ShallowUnwrapRef<PatchbayChannelDialogsRawModel>;

type PatchbayQuickSwitcherRawModel = {
  open: RefLike<boolean>;
  query: RefLike<string>;
  activeIndex: RefLike<number>;
  items: RefLike<readonly QuickSwitcherItem[]>;
  setOpen(open: boolean): void;
  setQuery(query: string): void;
  setActiveIndex(index: number): void;
  handleSelect(item: QuickSwitcherItem): void;
};
/**
 * Patchbay 页面快速切换器 section model。
 */
export type PatchbayQuickSwitcherModel = ShallowUnwrapRef<PatchbayQuickSwitcherRawModel>;

type CreatePatchbayServerRailSectionDeps = {
  racks: RefLike<readonly { serverSocket: string; name: string }[]>;
  activeSocket: RefLike<string>;
  handleSwitchServer(serverSocket: string): void;
  handleOpenServers(): void;
  handleOpenSettings(): void;
  goPlugins(): void;
};

/**
 * 创建服务器侧栏 section model。
 */
export function createPatchbayServerRailSection(deps: CreatePatchbayServerRailSectionDeps): PatchbayServerRailModel {
  return proxyRefs({
    racks: deps.racks,
    activeSocket: deps.activeSocket,
    handleSwitchServer: deps.handleSwitchServer,
    handleOpenServers: deps.handleOpenServers,
    handleOpenSettings: deps.handleOpenSettings,
    goPlugins: deps.goPlugins,
  });
}

type CreatePatchbayChatViewportSectionDeps = {
  showJumpToBottom: RefLike<boolean>;
  setSignalPaneRef(el: HTMLElement | null): void;
  handleJumpToBottom(): void;
  handleSignalScroll(): void;
  openChannelSettingsMenu(e: MouseEvent): void;
  handleMessageContextMenu(e: MouseEvent, messageId: string): void;
  handleMoreClick(e: MouseEvent, messageId: string): void;
  handleInstallHint(pluginId: string | undefined): void;
};

/**
 * 创建聊天视口 section model。
 */
export function createPatchbayChatViewportSection(deps: CreatePatchbayChatViewportSectionDeps): PatchbayChatViewportModel {
  return proxyRefs({
    showJumpToBottom: deps.showJumpToBottom,
    setSignalPaneRef: deps.setSignalPaneRef,
    handleJumpToBottom: deps.handleJumpToBottom,
    handleSignalScroll: deps.handleSignalScroll,
    openChannelSettingsMenu: deps.openChannelSettingsMenu,
    handleMessageContextMenu: deps.handleMessageContextMenu,
    handleMoreClick: deps.handleMoreClick,
    handleInstallHint: deps.handleInstallHint,
  });
}

type CreatePatchbayMessageContextMenuSectionDeps = {
  open: RefLike<boolean>;
  x: RefLike<number>;
  y: RefLike<number>;
  close(): void;
  handleAction(action: "copy" | "reply" | "delete" | "forward"): void;
};

/**
 * 创建消息右键菜单 section model。
 */
export function createPatchbayMessageContextMenuSection(
  deps: CreatePatchbayMessageContextMenuSectionDeps,
): PatchbayMessageContextMenuModel {
  return proxyRefs({
    open: deps.open,
    x: deps.x,
    y: deps.y,
    close: deps.close,
    handleAction: deps.handleAction,
  });
}

type CreatePatchbayChannelSettingsMenuSectionDeps = {
  open: RefLike<boolean>;
  x: RefLike<number>;
  y: RefLike<number>;
  close(): void;
  openMembers(channelId: string): void;
  openJoinApplications(channelId: string): void;
  openChannelBans(channelId: string): void;
  openDeleteChannelDialog(): void;
};

/**
 * 创建频道设置菜单 section model。
 */
export function createPatchbayChannelSettingsMenuSection(
  deps: CreatePatchbayChannelSettingsMenuSectionDeps,
): PatchbayChannelSettingsMenuModel {
  return proxyRefs({
    open: deps.open,
    x: deps.x,
    y: deps.y,
    close: deps.close,
    openMembers: deps.openMembers,
    openJoinApplications: deps.openJoinApplications,
    openChannelBans: deps.openChannelBans,
    openDeleteChannelDialog: deps.openDeleteChannelDialog,
  });
}

type CreatePatchbayChannelDialogsSectionDeps = {
  showCreateChannel: RefLike<boolean>;
  showDeleteChannel: RefLike<boolean>;
  deleteChannelId: RefLike<string>;
  deleteChannelName: RefLike<string>;
  setShowCreateChannel(visible: boolean): void;
  setShowDeleteChannel(visible: boolean): void;
  handleChannelCreated(channel: { id: string; name: string }): void;
  handleChannelDeleted(): void;
};

/**
 * 创建频道弹窗 section model。
 */
export function createPatchbayChannelDialogsSection(deps: CreatePatchbayChannelDialogsSectionDeps): PatchbayChannelDialogsModel {
  return proxyRefs({
    showCreateChannel: deps.showCreateChannel,
    showDeleteChannel: deps.showDeleteChannel,
    deleteChannelId: deps.deleteChannelId,
    deleteChannelName: deps.deleteChannelName,
    setShowCreateChannel: deps.setShowCreateChannel,
    setShowDeleteChannel: deps.setShowDeleteChannel,
    handleChannelCreated: deps.handleChannelCreated,
    handleChannelDeleted: deps.handleChannelDeleted,
  });
}

type CreatePatchbayQuickSwitcherSectionDeps = {
  open: RefLike<boolean>;
  query: RefLike<string>;
  activeIndex: RefLike<number>;
  items: RefLike<readonly QuickSwitcherItem[]>;
  setOpen(open: boolean): void;
  setQuery(query: string): void;
  setActiveIndex(index: number): void;
  handleSelect(item: QuickSwitcherItem): void;
};

/**
 * 创建快速切换器 section model。
 */
export function createPatchbayQuickSwitcherSection(deps: CreatePatchbayQuickSwitcherSectionDeps): PatchbayQuickSwitcherModel {
  return proxyRefs({
    open: deps.open,
    query: deps.query,
    activeIndex: deps.activeIndex,
    items: deps.items,
    setOpen: deps.setOpen,
    setQuery: deps.setQuery,
    setActiveIndex: deps.setActiveIndex,
    handleSelect: deps.handleSelect,
  });
}
