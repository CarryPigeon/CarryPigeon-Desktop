<script setup lang="ts">
import ServerList from "../components/lists/ServerList.vue";
import ServerNameModel from "../components/modals/ServerNameModel.vue";
import ChannelList from "../components/lists/ChannelList.vue";
import {invoke} from "@tauri-apps/api/core";
import UserComponent from "../components/users/UserComponent.vue";
import SearchBar from "../components/inputs/SearchBar.vue";
import TextArea from "../components/inputs/TextArea.vue";
import ParticipantsList, {Member} from "../components/lists/ParticipantsList.vue";
import ChatBox from "../components/messages/ChatBox.vue";
import Avatar from "/test_avatar.jpg?url";

invoke("to_chat_window_size");


const a : Member ={
  id: 1,
  name: '张三',
  avatar: Avatar,
  description: '111',
};
</script>

<template>
  <ServerList/>
  <ServerNameModel/>
  <ChannelList/>
  <UserComponent/>
  <SearchBar/>
  <TextArea/>
  <ParticipantsList :length="1" :online="1" :member="[a]"/>
  <ChatBox />
</template>
<style scoped lang="sass">
</style>