<script setup lang="ts">
import {ref} from "vue";
import search from '/search.svg?url';


const search_value = ref('')
</script>

<template>
  <div class="search-bar">
    <img class="search-icon" :src="search" alt="search"/>
    <div class="researcher">
      <Input class="input" v-model="search_value" :placeholder="$t('search_bar')"/>
    </div>
  </div>
</template>

<style scoped lang="sass">
.search-bar
  position: fixed
  display: flex
  left: 320px
  top: 0
  width: calc(100vw - 60px)
  height: 61px
  opacity: 1
  background: rgba(245, 245, 245, 1)

.researcher
  position: fixed
  display: flex
  //left: 641px
  left: max(325px, calc(100vw - 590px))
  top: 10px
  width: 292px
  height: 36px
  opacity: 1
  border-radius: 50px
  background: rgba(240, 240, 240, 1)

.input
  display: flex
  margin-left: 30px
  border: none
  background: transparent
  outline: none
  flex: 1
  padding: 0 15px
  font-size: 14px

.search-icon
  display: flex
  position: fixed
  left: max(340px, calc(100vw - 575px))
  top: 20px
  border: none
  background: transparent
  outline: none
  flex: 1
  z-index: 1
</style>