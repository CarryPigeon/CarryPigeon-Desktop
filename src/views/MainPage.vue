<script setup lang="ts">
import { computed, ref } from "vue";
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
import MemberContextMenu, { type MemberMenuAction } from "../components/items/MemberContextMenu.vue";
import Avatar from "/test_avatar.jpg?url";
import server_socket from "./LoginPage.vue";
import ChannelMessageService from "../api/channel/Channel.ts";
import PluginLoaderPanel from "../components/debug/PluginLoaderPanel.vue";
import PluginHost from "../components/plugins/PluginHost.vue";
import type { PluginManifest } from "../script/service/PluginLoader";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { copyTextToClipboard } from "../script/utils/clipboard";
import { dispatchInsertText } from "../script/utils/messageEvents";
import { isIgnoredUser, toggleIgnoreUser } from "../script/store/ignoreStore";

void invoke("to_chat_window_size")
  .then(() => getCurrentWindow().center())
  .catch(() => {});

const showPluginLoaderPanel = ref(false);
const { t } = useI18n();

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

const memberMenuOpen = ref(false);
const memberMenuClient = ref({ x: 0, y: 0 });
const memberMenuScreen = ref({ x: 0, y: 0 });
const selectedMember = ref<Member | null>(null);

const selectedMemberMuted = computed(() => {
  const member = selectedMember.value;
  return member ? isIgnoredUser(member.id) : false;
});

function openMemberContextMenuFromChat(payload: {
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  userId: number;
  name: string;
  avatar: string;
}) {
  const member: Member = {
    id: payload.userId,
    name: payload.name,
    avatar: payload.avatar,
    description: "",
    email: "",
  };
  openMemberContextMenu({
    screenX: payload.screenX,
    screenY: payload.screenY,
    clientX: payload.clientX,
    clientY: payload.clientY,
    member,
  });
}

function openMemberContextMenu(payload: {
  screenX: number;
  screenY: number;
  clientX: number;
  clientY: number;
  member: Member;
}) {
  memberMenuClient.value = { x: payload.clientX, y: payload.clientY };
  memberMenuScreen.value = { x: payload.screenX, y: payload.screenY };
  selectedMember.value = payload.member;
  memberMenuOpen.value = true;
}

async function handleMemberMenuAction(action: MemberMenuAction) {
  const member = selectedMember.value;
  if (!member) return;

  switch (action) {
    case "sendMessage":
      dispatchInsertText(`/msg ${member.name} `);
      return;
    case "mention":
      dispatchInsertText(`@${member.name} `);
      return;
    case "viewProfile":
      openMemberPopover({
        screenX: memberMenuScreen.value.x,
        screenY: memberMenuScreen.value.y,
        member,
      });
      return;
    case "report": {
      const payload = `uid: ${member.id}\nname: ${member.name}\nemail: ${member.email ?? ""}`;
      const ok = await copyTextToClipboard(payload);
      if (ok) MessagePlugin.success(t("member_report_copied"), 2000);
      else MessagePlugin.error(t("copy_failed"), 2000);
      return;
    }
    case "toggleMute": {
      const wasMuted = isIgnoredUser(member.id);
      toggleIgnoreUser(member.id);
      MessagePlugin.success(wasMuted ? t("member_unmuted_toast") : t("member_muted_toast"), 2000);
      return;
    }
  }
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
    <ParticipantsList
      :length="1"
      :online="1"
      :member="[a]"
      @avatar-click="openMemberPopover"
      @avatar-contextmenu="openMemberContextMenu"
    />
    <ChatBox :user_id="a.id" @avatar-contextmenu="openMemberContextMenuFromChat" />
  </template>

  <MemberContextMenu
    v-model:open="memberMenuOpen"
    :x="memberMenuClient.x"
    :y="memberMenuClient.y"
    :muted="selectedMemberMuted"
    @action="handleMemberMenuAction"
  />

  <PluginLoaderPanel v-if="showPluginLoaderPanel" />
</template>

<style scoped lang="scss"></style>
