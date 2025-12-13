<script setup lang="ts">
import ServerList from "../components/lists/ServerList.vue";
import ServerNameModel from "../components/modals/ServerNameModel.vue";
import ChannelList from "../components/lists/ChannelList.vue";
import { invoke } from "@tauri-apps/api/core";
import UserComponent from "../components/users/UserComponent.vue";
import SearchBar from "../components/inputs/SearchBar.vue";
import TextArea from "../components/inputs/TextArea.vue";
import ParticipantsList, { Member } from "../components/lists/ParticipantsList.vue";
import ChatBox from "../components/messages/ChatBox.vue";
import Avatar from "/test_avatar.jpg?url";
import server_socket from "./LoginPage.vue";
import ChannelMessageService from "../api/channel/Channel.ts";

invoke("to_chat_window_size");

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
  <ServerList />
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
  <TextArea />
  <ParticipantsList :length="1" :online="1" :member="[a]" @avatar-click="openMemberPopover" />
  <ChatBox :user_id="a.id" />
</template>
<style scoped lang="scss"></style>
