<script setup lang="ts">
export interface GroupModelProps {
  imgUrl: string
  groupName: string
  latestMsg: string
  onClick: () => void
}
const props = defineProps<GroupModelProps>()
</script>

<template>
  <div class="groupModel">
    <img :src="props.imgUrl" alt=""/>
    <div class="info">
      <p class="groupName">{{props.groupName}}</p>
      <p class="latestMsg">{{props.latestMsg}}</p>
    </div>
  </div>
</template>

<style scoped lang="sass">

</style>