<script setup lang="ts">
export interface ChannelModelProps {
  imgUrl: string
  channelName: string
  latestMsg: string
  onClick: () => void
}
const props = defineProps<ChannelModelProps>()
</script>

<template>
  <div class="channelModel">
    <img :src="props.imgUrl" alt=""/>
    <div class="info">
      <p class="channelName">{{ props.channelName }}</p>
      <p class="latestMsg">{{props.latestMsg}}</p>
    </div>
  </div>
</template>

<style scoped lang="sass">

</style>