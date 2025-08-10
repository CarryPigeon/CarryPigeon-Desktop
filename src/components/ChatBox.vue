<script setup lang="ts">
import MemberMessageBubble from "./MemberMessageBubble.vue";
import Avatar from '/test_avatar.jpg?url';
</script>
<template>
  <div class="chat-box-container">
    <MemberMessageBubble name="张三" :avatar=Avatar message="111" date=""></MemberMessageBubble>
  </div>
</template>

<style scoped lang="sass">
.chat-box-container
  background-color: transparent
  position: fixed
  top: 61px
  left: 318px
  height: calc(100vh - 161px)
  width: calc(100vw - 558px)
  overflow-y: auto
</style>

