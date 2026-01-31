<script setup lang="ts">
/**
 * @fileoverview SettingSwitch.vue 文件职责说明。
 */

import { Switch, SwitchProps } from 'tdesign-vue-next';
import { ref } from 'vue';

const props = defineProps<{
  text: string;
  value: boolean;
  server_socket?: string;
  onChange?: (key:string,value:boolean) => void;
}>();

const onChange:SwitchProps['onChange'] = (value) => {
  props.onChange?.(props.text, <boolean>value.valueOf());
};

const value = ref(props.value);


</script>

<template>
  <!-- 组件：SettingSwitch｜职责：设置项开关（标题 + Switch） -->
  <!-- 区块：<div> .setting-item-content -->
  <div class="setting-item-content">
    <!-- 区块：<div> .setting-item-content-item-title -->
    <div class="setting-item-content-item-title">{{ $t(props.text) }}</div>
    <Switch class="setting-item-content-item-switch" v-model="value" @change="onChange" />
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
/* 样式：.setting-item-content-item-switch */
.setting-item-content-item-switch {
  margin-left: auto;
  text-align: right;
  --td-brand-color: var(--cp-accent);
}
</style>
