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
    <div class="member-bubble-content">{{ props.message }}</div>
    <div class="member-name">{{ props.date }} - {{ props.name }}</div>
    <div class="member-bubble-avatar">
      <img class="member-avatar" :src="props.avatar" alt=""/>
    </div>
  </div>
</template>

<style scoped lang="sass">
.member-bubble
  display: flex
  align-items: flex-start
  justify-content: flex-end
  margin-top: 5px
  margin-bottom: 20px
  margin-right: 5px
  background: transparent
.member-avatar
  width: 40px
  height: 40px
  margin-right: 0
  margin-top: 5px
  border-radius: 50%
  object-fit: cover
.member-bubble-content
  background: rgba(224, 231, 255, 1)
  border-radius: 10px
  padding: 10px
  margin-top: 20px
  margin-right: -175px
  max-width: 70%
// 防止消息过长挤占太多空间
.member-name
  font-size: 14px
  margin-top: 0
  margin-right: 10px
  margin-bottom: 0

</style>