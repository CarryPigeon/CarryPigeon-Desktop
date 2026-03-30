<script setup lang="ts">
/**
 * @fileoverview 聊天主页面（Patchbay 主窗口）
 * @description 路由 `/chat` 的主窗口：机架（服务器）/频道/消息流/编辑器/成员列表。
 */

import ServerRail from "@/features/chat/presentation/patchbay/components/layout/ServerRail.vue";
import ChannelRail from "@/features/chat/presentation/patchbay/components/layout/ChannelRail.vue";
import MembersRail from "@/features/chat/presentation/patchbay/components/layout/MembersRail.vue";
import ChannelSettingsMenu from "@/features/chat/presentation/patchbay/components/menus/ChannelSettingsMenu.vue";
import ChatCenter from "@/features/chat/presentation/patchbay/components/layout/ChatCenter.vue";
import { usePatchbayPageModel } from "@/features/chat/presentation/patchbay/page/usePatchbayPageModel";
import MessageContextMenu from "@/features/chat/presentation/patchbay/components/menus/MessageContextMenu.vue";
import QuickSwitcher from "@/features/chat/presentation/patchbay/components/overlay/QuickSwitcher.vue";
import CreateChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/CreateChannelDialog.vue";
import DeleteChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/DeleteChannelDialog.vue";

const page = usePatchbayPageModel();
</script>

<template>
  <!-- 页面：MainPage｜职责：Patchbay 主窗口四栏布局 -->
  <!-- 区块：<main> .cp-main -->
  <main class="cp-main">
    <div v-if="page.flashMessage" class="cp-flash">{{ page.flashMessage }}</div>
    <ServerRail
      :racks="page.serverRail.racks"
      :active-socket="page.serverRail.activeSocket"
      @switch="page.serverRail.handleSwitchServer"
      @open-servers="page.serverRail.handleOpenServers"
      @open-plugins="page.serverRail.goPlugins"
      @open-settings="page.serverRail.handleOpenSettings"
    />

    <ChannelRail :model="page.channelRail" />

    <ChatCenter
      :model="page.chatCenter"
      :show-jump-to-bottom="page.chatViewport.showJumpToBottom"
      :on-jump-to-bottom="page.chatViewport.handleJumpToBottom"
      :on-signal-scroll="page.chatViewport.handleSignalScroll"
      :register-signal-pane="page.chatViewport.setSignalPaneRef"
      :on-open-channel-settings-menu="page.chatViewport.openChannelSettingsMenu"
      :on-message-context-menu="page.chatViewport.handleMessageContextMenu"
      :on-more-click="page.chatViewport.handleMoreClick"
      :on-install-hint="page.chatViewport.handleInstallHint"
    />

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
      @close="page.messageContextMenu.close"
      @action="page.messageContextMenu.handleAction"
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

    <!-- 区块：创建频道弹窗（Create Channel Dialog） -->
    <CreateChannelDialog
      :visible="page.channelDialogs.showCreateChannel"
      @update:visible="page.channelDialogs.setShowCreateChannel($event)"
      @created="page.channelDialogs.handleChannelCreated"
    />

    <!-- 区块：删除频道弹窗（Delete Channel Dialog） -->
    <DeleteChannelDialog
      :visible="page.channelDialogs.showDeleteChannel"
      :channel-id="page.channelDialogs.deleteChannelId"
      :channel-name="page.channelDialogs.deleteChannelName"
      @update:visible="page.channelDialogs.setShowDeleteChannel($event)"
      @deleted="page.channelDialogs.handleChannelDeleted"
    />
  </main>
</template>
