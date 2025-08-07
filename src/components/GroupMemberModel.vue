<script setup lang="ts">
const props = defineProps<{
  avatar: string
  name: string
}>()
</script>

<template>
<div class = "group-member-model">
  <img class="member-avatar" :src="props.avatar" alt=""/>
  <p class="member-name"> {{ props.name }} </p>
</div>
</template>

<style scoped lang="sass">
.group-member-model
  display: grid
  align-items: center
.member-avatar
  margin-left: 15px
  // 头像为已裁切图片
  background-size: 30px, 30px
.member-name
  margin-left: 15px
</style>