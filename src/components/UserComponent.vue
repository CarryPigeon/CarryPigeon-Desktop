<script setup lang="ts">
const props = defineProps({
  avatar: String,
  name: String,
  description: String,
})
</script>

<template>
<div class="container">
  <img class ="image" :src="props.avatar" alt="avatar"/>
  <p class="username"> {{props.name}} </p>
  <p class="description"> {{props.description}} </p>
</div>
</template>

<style scoped lang="sass">
.container
  position: absolute
  left: 63px
  top: calc(100vh - 60px)
  width: 257px
  height: 60px
  opacity: 1
  background: rgba(229, 231, 235, 1)
.image
  background-size: 30px 30px
  left: 86px
  top: 654px
  width: 30px
  height: 30px
  opacity: 1
  background: rgba(204, 204, 204, 1)
.username
  position: fixed
  left: 128px
  top: calc(100vh - 60px)
  width: 57px
  height: 18px
  opacity: 1
  background: rgba(0, 0, 0, 1)
  /** 文本 */
  font-size: 12px
  font-weight: 400
  letter-spacing: 0
  line-height: 17.38px
  color: rgba(0, 0, 0, 1)
  text-align: left
  vertical-align: middle
.description
  position: fixed
  left: 128px
  top: calc(100vh - 36px)
  width: 91px
  height: 18px
  opacity: 1
  background: rgba(35, 66, 87, 1)
  /** 文本 */
  font-size: 12px
  font-weight: 400
  letter-spacing: 0
  line-height: 17.38px
  color: rgba(35, 66, 87, 1)
  text-align: left
  vertical-align: middle
</style>