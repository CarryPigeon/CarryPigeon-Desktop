<script setup lang="ts">
import {ref} from "vue";

const text = ref('')
</script>

<template>
  <div class="text-area">
    <textarea
        v-model="text"
        placeholder=""
        class="text-area-item"
        wrap="soft"
    ></textarea>
  </div>
</template>

<style scoped lang="sass">
.text-area
  display: grid
  grid-template-columns: 1fr
  grid-template-rows: 1fr
  position: fixed
  left: 319px
  top: calc(100vh - 100px)
  width: calc(100vw - 558px)
  height: 100px
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border: 1px solid rgba(231, 232, 236, 1)
  box-sizing: border-box

.text-area-item
  width: 98% !important
  height: 95% !important
  margin: 10px 10px 5px
  border: none
  background: transparent
  outline: none
  resize: none
  box-sizing: border-box
</style>