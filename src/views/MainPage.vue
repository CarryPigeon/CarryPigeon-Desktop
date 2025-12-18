<script setup lang="ts">
import { ref } from "vue";
import ServerList from "../components/lists/ServerList.vue";
import ServerNameModel from "../components/modals/ServerNameModel.vue";
import ChannelList from "../components/lists/ChannelList.vue";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import UserComponent from "../components/users/UserComponent.vue";
import SearchBar from "../components/inputs/SearchBar.vue";
import TextArea from "../components/inputs/TextArea.vue";
import ParticipantsList, { Member } from "../components/lists/ParticipantsList.vue";
import ChatBox from "../components/messages/ChatBox.vue";
import Avatar from "/test_avatar.jpg?url";
import server_socket from "./LoginPage.vue";
import ChannelMessageService from "../api/channel/Channel.ts";
import PluginLoaderPanel from "../components/debug/PluginLoaderPanel.vue";
import PluginHost from "../components/plugins/PluginHost.vue";
import type { PluginManifest } from "../script/service/PluginLoader";

void invoke("to_chat_window_size")
  .then(() => getCurrentWindow().center())
  .catch(() => {});

const showPluginLoaderPanel = ref(false);

function togglePluginLoaderPanel(): void {
  showPluginLoaderPanel.value = !showPluginLoaderPanel.value;
}

const activePlugin = ref<PluginManifest | null>(null);

function onSelectPlugin(plugin: PluginManifest) {
  activePlugin.value = plugin;
}

function closePlugin() {
  activePlugin.value = null;
}

const channelMessageService = new ChannelMessageService(server_socket.value);
const a: Member = {
  id: 1,
  name: "张三",
  avatar: Avatar,
  description: "热爱 Rust 与前端工程化，喜欢构建好用的桌面应用。",
  email: "zhangsan@example.com",
};

const popoverSize = {
  width: 320,
  height: 140,
};

function connect_server(socket: string) {
  invoke("add_tcp_service", { socket });
}

connect_server(server_socket.value);
channelMessageService.getAllUnreceivedMessages();

function openMemberPopover(payload: { screenX: number; screenY: number; member: Member }) {
  const query = new URLSearchParams({
    window: "user-popover",
    avatar: payload.member.avatar,
    name: payload.member.name,
    email: payload.member.email ?? "",
    bio: payload.member.description,
  }).toString();

  invoke("open_user_popover_window", {
    query,
    x: payload.screenX,
    y: payload.screenY,
    width: popoverSize.width,
    height: popoverSize.height,
  });
}

function openUserPopover(pos: { screenX: number; screenY: number }) {
  openMemberPopover({ ...pos, member: a });
}
</script>

<template>
  <ServerList
    :active-plugin-name="activePlugin?.name ?? null"
    @select-plugin="onSelectPlugin"
    @close-plugin="closePlugin"
    @toggle-plugin-loader-panel="togglePluginLoaderPanel"
  />
  <ServerNameModel />
  <ChannelList />
  <UserComponent
    :avatar="a.avatar"
    :name="a.name"
    :description="a.description"
    :id="a.id"
    @avatar-click="openUserPopover"
  />
  <SearchBar />

  <PluginHost v-if="activePlugin" :manifest="activePlugin" @close="closePlugin" />

  <template v-else>
    <TextArea />
    <ParticipantsList :length="1" :online="1" :member="[a]" @avatar-click="openMemberPopover" />
    <ChatBox :user_id="a.id" />
  </template>

  <PluginLoaderPanel v-if="showPluginLoaderPanel" />
</template>

<style scoped lang="scss"></style>
