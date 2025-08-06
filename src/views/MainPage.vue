<script setup lang="ts">
import ServerList from "../components/ServerList.vue";
import ServerNameModel from "../components/ServerNameModel.vue";
import ChannelList from "../components/ChannelList.vue";
import {invoke} from "@tauri-apps/api/core";
import UserComponent from "../components/UserComponent.vue";
import SearchBar from "../components/SearchBar.vue";
import TextArea from "../components/TextArea.vue";

invoke("to_chat_window_size");

</script>

<template>
  <ServerList/>
  <ServerNameModel/>
  <ChannelList/>
  <UserComponent/>
  <SearchBar/>
  <TextArea />
</template>
<style scoped lang="sass">
</style>