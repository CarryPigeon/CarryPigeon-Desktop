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

<style scoped lang="scss">
.group-member-model {
  //display: flex;
  align-items: center;
}
.member-avatar {
  width: 40px;
  height: 40px;
  margin-left: 15px;
  margin-right: 0;
  margin-top: 50px;
  border-radius: 50%;
  object-fit: cover;
}
.member-name {
  margin-left: 100px;
  margin-top: -40px;
}
</style>