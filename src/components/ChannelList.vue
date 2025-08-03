<script setup lang="ts">
import {reactive, Ref} from 'vue'
interface ChannelProps{
  channel: string
  active: boolean
  imageUrl: Ref<string>
  onClick: () => void
}
interface AvatarProps {
  username: Ref<string>
  imageUrl: Ref<string>
  onClick: () => void
}

const avatar_props = reactive<AvatarProps>({} as AvatarProps);
const channel_props = reactive<ChannelProps[]>([] as ChannelProps[]);

function addChannel(channel: string, active: boolean, imageUrl: string, onClick: () => void) {
  channel_props.push({channel, active, imageUrl, onClick});
}

function deleteChannel(channel: string) {
  const index = channel_props.findIndex(item => item.channel === channel);
  if (index !== -1) {
    channel_props.splice(index, 1);
  }
}

function getAvatar(username: string, imageUrl: string, onClick: () => void) {
  avatar_props.username = username;
  avatar_props.imageUrl = imageUrl;
  avatar_props.onClick = onClick;
}

defineExpose({
  addChannel,
  deleteChannel,
  getAvatar,
})

</script>

<template>
<div class="list">
  <img class="avatar" :src="avatar_props.imageUrl" alt="avatar" @click="avatar_props.onClick">
  <ul>
    <li v-for="item in channel_props" :key="item.channel" @click="item.onClick">
      <img class="image" :src= "item.imageUrl" alt="item.channel">
    </li>
  </ul>
</div>
</template>

<style scoped lang="sass">
.list
  left: 0
  top: 0
  width: 65px
  height: 700px
  opacity: 1
  background: rgba(17, 24, 39, 1)
.image
  left: 207px
  top: 552px
  width: 48px
  height: 48px
  opacity: 1
  border-radius: 8px
.avatar
  left: 8px
  top: 7px
  width: 48px
  height: 48px
  opacity: 1
  border-radius: 8px
</style>