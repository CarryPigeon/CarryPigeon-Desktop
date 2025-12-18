<script setup lang="ts">
import { reactive, ref } from "vue";
import Avatar from "/test_avatar.jpg?url";
import { useRouter } from "vue-router";
import PluginList from "./PluginList.vue";
import type { PluginManifest } from "../../script/service/PluginLoader";
import ChannelContextMenu, { type ChannelMenuAction } from "../items/ChannelContextMenu.vue";

const props = defineProps<{
  activePluginName?: string | null;
}>();

const emit = defineEmits<{
  (e: "select-plugin", manifest: PluginManifest): void;
  (e: "close-plugin"): void;
  (e: "toggle-plugin-loader-panel"): void;
}>();

const router = useRouter();

function click_avatar() {
  router.push("/user_info");
}

interface ChannelProps {
  channel: string;
  active: boolean;
  imageUrl: string;
  onClick: () => void;
}

interface AvatarProps {
  username: string;
  imageUrl: string;
}

const avatar_props = reactive<AvatarProps>({
  username: "",
  imageUrl: "",
});
const channel_props = reactive<ChannelProps[]>([] as ChannelProps[]);

const menuOpen = ref(false);
const menuPosition = ref({ x: 0, y: 0 });
const selectedChannel = ref<ChannelProps | null>(null);

function handleContextMenu(event: MouseEvent, item: ChannelProps) {
  event.preventDefault();
  menuPosition.value = { x: event.clientX, y: event.clientY };
  selectedChannel.value = item;
  menuOpen.value = true;
}

async function handleMenuAction(action: ChannelMenuAction) {
  if (!selectedChannel.value) return;

  switch (action) {
    case 'copyId':
      await navigator.clipboard.writeText(selectedChannel.value.channel);
      break;
    case 'copyName':
      await navigator.clipboard.writeText(selectedChannel.value.channel);
      break;
    case 'pin':
      console.log('Pin channel:', selectedChannel.value.channel);
      break;
    case 'settings':
      console.log('Settings for channel:', selectedChannel.value.channel);
      break;
    case 'deleteHistory':
      console.log('Delete history for channel:', selectedChannel.value.channel);
      break;
  }
}

function addChannel(channel: string, active: boolean, imageUrl: string, onClick: () => void) {
  channel_props.push({ channel, active, imageUrl, onClick });
}

function deleteChannel(channel: string) {
  const index = channel_props.findIndex((item) => item.channel === channel);
  if (index !== -1) {
    channel_props.splice(index, 1);
  }
}

function getAvatar(username: string, imageUrl: string) {
  avatar_props.username = username;
  avatar_props.imageUrl = imageUrl;
}

function onSelectPlugin(plugin: PluginManifest) {
  if ((props.activePluginName ?? null) === plugin.name) {
    emit("close-plugin");
    return;
  }
  emit("select-plugin", plugin);
}

function onTogglePluginLoaderPanel(): void {
  emit("toggle-plugin-loader-panel");
}

defineExpose({
  addChannel,
  deleteChannel,
  getAvatar,
});

addChannel("111", false, Avatar, () => {});
</script>

<template>
  <div class="list">
    <img class="avatar" :src="avatar_props.imageUrl" alt="avatar" @click="click_avatar" />

    <ul class="server_item_list">
      <li v-for="item in channel_props" :key="item.channel" @click="item.onClick" @contextmenu="(e) => handleContextMenu(e, item)">
        <img class="image" :src="item.imageUrl" :alt="item.channel" />
      </li>
    </ul>

    <ChannelContextMenu
      v-model:open="menuOpen"
      :x="menuPosition.x"
      :y="menuPosition.y"
      :cid="Number(selectedChannel?.channel) || undefined"
      :channel-name="selectedChannel?.channel ?? ''"
      @action="handleMenuAction"
    />

    <PluginList
      :active-plugin-name="props.activePluginName ?? null"
      @select="onSelectPlugin"
      @toggle-plugin-loader-panel="onTogglePluginLoaderPanel"
    />
  </div>
</template>

<style scoped lang="scss">
.list {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 65px;
  height: 100vh;
  background: rgba(17, 24, 39, 1);
  padding: 10px 0;
  box-sizing: border-box;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  margin-bottom: 15px;
  cursor: pointer;
  flex-shrink: 0;
}

.server_item_list {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-left: 0;
  padding-left: 0;
  margin-top: 0;
  width: 100%;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
}

.image {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
}
</style>
