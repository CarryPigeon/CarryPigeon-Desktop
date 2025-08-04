<script setup lang="ts">
import ChannelList from "../components/ChannelList.vue";
import ServerNameModel from "../components/ServerNameModel.vue";
import GroupList from "../components/GroupList.vue";
import {invoke} from "@tauri-apps/api/core";
import UserComponent from "../components/UserComponent.vue";
import SearchBar from "../components/SearchBar.vue";

invoke("to_chat_window_size");

</script>

<template>
  <ChannelList/>
  <ServerNameModel/>
  <GroupList/>
  <UserComponent/>
  <SearchBar/>
</template>
<style scoped lang="sass">
</style>