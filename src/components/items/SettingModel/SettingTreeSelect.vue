<script setup lang="ts">
import { TreeSelectProps } from 'tdesign-vue-next';
import { ref } from 'vue';

interface TreeNode {
  label: string;
  value: string;
  children?: TreeNode[];
}

const props = defineProps<{
  text: string;
  data: TreeNode[];
  value: string;
  onChange?: TreeSelectProps['onChange'];
}>();

const value = ref(props.value);

</script>

<template>
  <div class="setting-item-content">
    <div class="setting-item-content-item-title">{{ $t(props.text) }}
      <t-tree-select
        class="setting-item-content-item-tree-select"
        :data="props.data"
        v-model="value"
        @change="props.onChange"
      />
    </div>
  </div>
</template>

<style scoped lang="sass">
.setting-item-content
  display: flex
  align-items: center
  justify-content: space-between

.setting-item-content-item-title
  flex: 1
  display: flex
  align-items: center
.setting-item-content-item-tree-select
  margin-left: auto
  text-align: right
</style>