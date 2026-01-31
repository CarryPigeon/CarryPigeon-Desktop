<script setup lang="ts">
/**
 * @fileoverview SettingInput.vue 文件职责说明。
 */

import { Input, InputProps } from 'tdesign-vue-next';

const props = defineProps<{
  text: string;
  placeholder: string;
  server_socket?: string;
  onChange?: (key:string,value:string) => void;
}>();

const onChange: InputProps['onChange'] = (value) => {
  props.onChange?.(props.text, value.toString());
};

</script>

<template>
  <!-- 组件：SettingInput｜职责：设置项输入框（标题 + Input） -->
  <!-- 区块：<div> .setting-item-content -->
  <div class="setting-item-content">
    <!-- 区块：<div> .setting-item-content-item-title -->
    <div class="setting-item-content-item-title">{{ $t(props.text) }}</div>
    <Input class="setting-item-content-item-value" :placeholder="props.placeholder" @change="onChange" />
  </div>
</template>

<style scoped lang="scss">
/* 样式：设置项横向布局（标题 + 控件） */
.setting-item-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  gap: 16px;
}

/* 样式：.setting-item-content-item-title */
.setting-item-content-item-title {
  width: 70%;
  display: flex;
  align-items: center;
  color: var(--cp-text);
  font-weight: 500;
}
/* 样式：.setting-item-content-item-value */
.setting-item-content-item-value {
  width: 30%;
  text-align: left;
}
</style>
