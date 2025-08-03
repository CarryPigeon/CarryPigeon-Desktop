<script setup lang="ts">
import ChannelList from "../components/ChannelList.vue";
import ServerNameModel from "../components/ServerNameModel.vue";
import GroupList from "../components/GroupList.vue";
import {invoke} from "@tauri-apps/api/core";

invoke("to_chat_window_size");

</script>

<template>
  <div class="main">
    <div class ="serverNameModel">
      <ServerNameModel />
    </div>
    <ChannelList />
    <div class ="groupList">
      <GroupList />
    </div>
  </div>
</template>
<style scoped lang="sass">
</style>