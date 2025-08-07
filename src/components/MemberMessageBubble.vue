<script setup lang="ts">
const props = defineProps<{
  name: string,
  avatar: string,
  message: string,
  date: string,
}>();
</script>

<template>
<div class="member-bubble">
  <div class="member-bubble-avatar">
    <img :src="props.avatar" alt="">
  </div>
  <div class="member-name">{{props.name}}</div>
  <div class="member-bubble-content">{{props.message}}</div>
</div>
</template>

<style scoped lang="sass">
.member-bubble
  display: flex
  align-items: flex-start
  margin-bottom: 10px
  background: transparent
.member-avatar
  width: 40px
  height: 40px
  margin-right: 10px
  border-radius: 50%
  object-fit: cover
.member-bubble-content
  background-color: #f0f0f0
  border-radius: 10px
  padding: 10px
  margin-left: 10px
  max-width: 70% // 防止消息过长挤占太多空间
.member-name
  font-size: 14px
  margin: 0 0 0 10px

.member-bubble-content
  margin-top: 5px

</style>