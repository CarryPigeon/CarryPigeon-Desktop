<script setup lang="ts">
import ChannelModel, {ChannelModelProps} from "./ChannelModel.vue";
import {reactive} from "vue";

const channel_props = reactive([] as ChannelModelProps[]);

function addChannel(channel: ChannelModelProps) {
  channel_props.push(channel);
}

function deleteChannel(channel: string) {
  const index = channel_props.findIndex(item => item.channelName === channel);
  if (index !== -1) {
    channel_props.splice(index, 1);
  }
}

defineExpose({
  addChannel,
  deleteChannel
})

</script>

<template>
  <div class="channelList">
    <ul>
      <li v-for="item in channel_props">
        <ChannelModel v-bind="item"/>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="sass">
.channelList
  position: absolute
  left: 63px
  top: 60px
  width: 255px
  height: calc(100vh - 120px)
  // 60px(top) + 20px(底部边距)
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border: 1px solid rgba(231, 232, 236, 1)
  overflow-y: auto
</style>