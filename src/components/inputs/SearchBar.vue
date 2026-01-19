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

<style scoped lang="scss">
.search-bar {
  position: fixed;
  display: flex;
  // 动态计算左边距：ServerList(63px) + ChannelList 宽度
  left: calc(67px + var(--channel-list-width, 255px));
  top: 0;
  // 动态计算宽度：总宽度 - ServerList(63px) - ChannelList 宽度 - ParticipantsList 宽度
  width: calc(100vw - 63px - var(--channel-list-width, 255px) - var(--participants-list-width, 240px));
  height: 61px;
  opacity: 1;
  background: rgba(245, 245, 245, 1);
}

.researcher {
  position: absolute; // 改为 absolute 相对于 search-bar
  display: flex;
  right: 20px; // 距离搜索栏右侧 20px
  top: 10px;
  width: 292px;
  height: 36px;
  opacity: 1;
  border-radius: 50px;
  background: rgba(240, 240, 240, 1);
}

.input {
  display: flex;
  margin-left: 30px;
  border: none;
  background: transparent;
  outline: none;
  flex: 1;
  padding: 0 15px;
  font-size: 14px;
}

.search-icon {
  display: flex;
  position: absolute; // 改为 absolute 相对于 search-bar
  right: 280px; // 根据 researcher 的位置调整
  top: 20px;
  border: none;
  background: transparent;
  outline: none;
  z-index: 1;
}
</style>