<script setup lang="ts">
import { ref } from 'vue';
import ChannelModel, { type ChannelModelProps } from "../items/ChannelModel.vue";
import ChannelContextMenu, { type ChannelMenuAction } from "../items/ChannelContextMenu.vue";
import { useChannelStore } from "../../script/store/channelStore";

const { channels } = useChannelStore();

const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedChannel = ref<ChannelModelProps | null>(null);
const activeChannelCid = ref<number | undefined>(undefined);

function handleChannelClick(channel: ChannelModelProps) {
  if (channel.cid !== undefined) {
    activeChannelCid.value = channel.cid;
  }
}

function handleContextMenu(event: MouseEvent, channel: ChannelModelProps) {
  event.preventDefault();
  menuPosition.value = { x: event.clientX, y: event.clientY };
  selectedChannel.value = channel;
  menuOpen.value = true;
}

async function handleMenuAction(action: ChannelMenuAction) {
  if (!selectedChannel.value) return;

  switch (action) {
    case 'copyId':
      if (selectedChannel.value.cid) {
        await navigator.clipboard.writeText(selectedChannel.value.cid.toString());
      }
      break;
    case 'copyName':
      await navigator.clipboard.writeText(selectedChannel.value.channelName);
      break;
    case 'pin':
      // TODO: Implement pin logic
      console.log('Pin channel:', selectedChannel.value.channelName);
      break;
    case 'settings':
      // TODO: Implement settings logic
      console.log('Settings for channel:', selectedChannel.value.channelName);
      break;
    case 'settings_recv_notify':
      console.log('Settings: Receive and Notify for', selectedChannel.value.channelName);
      break;
    case 'settings_recv_silent':
      console.log('Settings: Receive Silent for', selectedChannel.value.channelName);
      break;
    case 'settings_no_recv':
      console.log('Settings: No Receive for', selectedChannel.value.channelName);
      break;
    case 'deleteHistory':
      // TODO: Implement delete history logic
      console.log('Delete history for channel:', selectedChannel.value.channelName);
      break;
  }
}
</script>

<template>
  <div class="channelList">
    <ul class="list">
      <li v-for="item in channels" :key="item.channelName">
        <ChannelModel
          v-bind="item"
          :active="item.cid === activeChannelCid"
          @click="handleChannelClick(item)"
          @contextmenu="(e: MouseEvent) => handleContextMenu(e, item)"
        />
      </li>
    </ul>

    <ChannelContextMenu
      v-model:open="menuOpen"
      :x="menuPosition.x"
      :y="menuPosition.y"
      :cid="selectedChannel?.cid"
      :channel-name="selectedChannel?.channelName ?? ''"
      @action="handleMenuAction"
    />
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
