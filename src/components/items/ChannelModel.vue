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
    <img class="channelImg" :src="props.imgUrl" loading="lazy" alt=""/>
    <div class="info">
      <p class="channelName">{{ props.channelName }}</p>
      <p class="latestMsg">{{props.latestMsg}}</p>
    </div>
  </div>
</template>

<style scoped lang="sass">
.channelModel
  display: flex
  align-items: center
  padding: 0
  cursor: pointer
  background: rgba(204, 204, 204, 1)
  width: 255px
  height: 70px
.channelImg
  width: 40px
  height: 40px
  margin-left: 5px
  margin-top: 5px
  border-radius: 50%
  object-fit: cover
.channelName
  font-size: 16px
  margin-top: 30px
  margin-left: 10px
  font-weight: 500
  color: rgba(0, 0, 0, 1)
.latestMsg
  margin-top: -19px
  margin-left: 10px
  font-size: 14px
  font-weight: 400
  color: rgba(0, 0, 0, 1)
.info
  flex: 1
</style>