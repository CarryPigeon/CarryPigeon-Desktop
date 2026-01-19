<script setup lang="ts">
import {ref} from 'vue'

const props = defineProps({
  serverName: String,
  onlineNumber: Number,
})
const serverName = ref(props.serverName)
//const onlineNumber = ref(props.onlineNumber)
</script>

<template>
<div class = "serverNameModel">
  <p class="serverName"> {{serverName}} </p>
  <!-- <p class="onlineNumber"> {{ onlineNumber }} 人在线 </p> -->
</div>
</template>

<style scoped lang="scss">
.serverNameModel {
  position: absolute;
  left: 65px;
  top: 0;
  width: var(--channel-list-width, 255px);
  /* 确保宽度与频道列表同步 */
  height: 60px;
  opacity: 1;
  background: rgba(243, 244, 246, 1);
  border: 1px solid rgba(231, 232, 236, 1);
}
.serverName {
  left: 76px;
  top: 0;
  width: 241px;
  height: 60px;
  opacity: 1;
  //background: rgba(0, 0, 0, 1);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 20.27px;
  color: rgba(0, 0, 0, 1);
  text-align: left;
  vertical-align: middle;
}

//.onlineNumber
  // TODO: 待完善
</style>