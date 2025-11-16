<script setup lang="ts">
import GroupMemberModel from "../items/GroupMemberModel.vue";

export interface Member {
  id: number
  name: string
  avatar: string
  description: string
}

const props = defineProps<{
  length: number
  online: number
  member: Member[]
}>()
</script>

<template>
<div class="participants-list">
  <div class = "participants-number">
    <p>{{$t('participants')}} - {{props.length}}</p>
  </div>
  <div class="list">
    <ul style="list-style-type: none; padding: 0;">
      <li v-for="item in props.member" :key="item.id">
        <GroupMemberModel :avatar="item.avatar" :name="item.name"/>
      </li>
    </ul>
  </div>
</div>
</template>

<style scoped lang="sass">
.list
  position: fixed
  display: grid
  left: calc(100vw - 240px)
  padding: 0
  top: 0
  width: 240px
  //height: 700px
  height: calc(100vh - 3px)
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border: 1px solid rgba(231, 232, 236, 1)
.participants-number
  z-index: 1
  position: fixed
  left: calc(100vw - 240px)
  margin-left: 10px
  top: 0
  width: 240px
  border: none
  box-sizing: border-box
  height: 50px
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border-bottom: 1px solid rgba(227, 229, 233, 1)
</style>