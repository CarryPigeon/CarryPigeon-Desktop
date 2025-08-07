<script setup lang="ts">
import ServerList from "../components/ServerList.vue";
import ServerNameModel from "../components/ServerNameModel.vue";
import ChannelList from "../components/ChannelList.vue";
import {invoke} from "@tauri-apps/api/core";
import UserComponent from "../components/UserComponent.vue";
import SearchBar from "../components/SearchBar.vue";
import TextArea from "../components/TextArea.vue";
import ParticipantsList from "../components/ParticipantsList.vue";
import ChatBox from "../components/ChatBox.vue";

invoke("to_chat_window_size");

</script>

<template>
  <ServerList/>
  <ServerNameModel/>
  <ChannelList/>
  <UserComponent/>
  <SearchBar/>
  <TextArea/>
  <ParticipantsList :length="0" :online="0" :member="[]"/>
  <ChatBox />
</template>
<style scoped lang="sass">
</style>