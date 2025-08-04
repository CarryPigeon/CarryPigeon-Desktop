<script setup lang="ts">
import ChannelList from "../components/ChannelList.vue";
import ServerNameModel from "../components/ServerNameModel.vue";
import GroupList from "../components/GroupList.vue";
import {invoke} from "@tauri-apps/api/core";
import UserComponent from "../components/UserComponent.vue";

invoke("to_chat_window_size");

</script>

<template>
  <div class="main">
    <div class="channelList">
      <ChannelList />
    </div>
    <div class ="serverNameModel">
      <ServerNameModel />
    </div>
    <div class ="groupList">
      <GroupList />
    </div>
    <div class ="userComponent">
      <UserComponent />
    </div>
  </div>
</template>
<style scoped lang="sass">
.main
  display: flex
.channelList
  display: flex
  flex: 1
</style>