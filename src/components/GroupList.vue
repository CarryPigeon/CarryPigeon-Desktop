<script setup lang="ts">
import GroupModel, { GroupModelProps } from "./GroupModel.vue";
import {reactive} from "vue";

const group_props = reactive([] as GroupModelProps[]);

function addGroup(group: GroupModelProps) {
  group_props.push(group);
}

function deleteGroup(group: string) {
  const index = group_props.findIndex(item => item.groupName === group);
  if (index !== -1) {
    group_props.splice(index, 1);
  }
}

defineExpose({
  addGroup,
  deleteGroup
})

</script>

<template>
  <div class="groupList">
    <ul>
      <li v-for="item in group_props">
        <GroupModel v-bind="item"/>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="sass">
.groupList
  position: absolute
  left: 63px
  top: 60px
  width: 255px
  height: 640px
  opacity: 1
  background: rgba(243, 244, 246, 1)
  border: 1px solid rgba(231, 232, 236, 1)
</style>