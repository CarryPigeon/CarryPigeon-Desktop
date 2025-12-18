<script setup lang="ts">
import ChannelModel from "../items/ChannelModel.vue";
import { useChannelStore } from "../../script/store/channelStore";

const { channels } = useChannelStore();
</script>

<template>
  <div class="channelList">
    <ul class="list">
      <li v-for="item in channels" :key="item.channelName">
        <ChannelModel v-bind="item" />
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.channelList {
  position: absolute;
  left: 63px;
  top: 60px;
  width: 255px;
  height: calc(100vh - 120px);
  opacity: 1;
  background: rgba(243, 244, 246, 1);
  border: 1px solid rgba(231, 232, 236, 1);
  overflow-y: auto;
}

.list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
</style>
