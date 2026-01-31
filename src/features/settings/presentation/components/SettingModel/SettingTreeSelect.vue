<script setup lang="ts">
/**
 * @fileoverview SettingTreeSelect.vue 文件职责说明。
 */

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
  <!-- 组件：SettingTreeSelect｜职责：设置项树选择（标题 + TreeSelect） -->
  <!-- 区块：<div> .setting-item-content -->
  <div class="setting-item-content">
    <!-- 区块：<div> .setting-item-content-item-title -->
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

<style scoped lang="scss">
/* 样式：设置项横向布局（标题 + 控件） */
.setting-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

/* 样式：.setting-item-content-item-title */
.setting-item-content-item-title {
  flex: 1;
  display: flex;
  align-items: center;
  color: var(--cp-text);
  font-weight: 500;
}
/* 样式：.setting-item-content-item-tree-select */
.setting-item-content-item-tree-select {
  margin-left: auto;
  text-align: right;
  --td-brand-color: var(--cp-accent);
  --td-border-level-2-color: rgba(15, 118, 110, 0.18);
  --td-text-color-primary: var(--cp-text);
  --td-radius-default: 10px;
}
</style>
