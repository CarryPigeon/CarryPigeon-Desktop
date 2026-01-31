<script setup lang="ts">
/**
 * @fileoverview SettingButton.vue 文件职责说明。
 */

import { Button } from 'tdesign-vue-next';
import type { Theme } from "./SettingButtonTheme";

const props = defineProps<{
  text: string;
  theme: Theme;
  placeholder: string;
}>();

</script>

<template>
  <!-- 组件：SettingButton｜职责：设置项按钮（标题 + 按钮） -->
  <!-- 区块：<div> .setting-item-content -->
  <div class="setting-item-content">
    <!-- 区块：<div> .setting-item-content-item-title -->
    <div class="setting-item-content-item-title">{{ $t(props.text) }}</div>
    <!-- 区块：<button> -->
    <!-- 区块：<Button> -->
    <!-- 区块：<button> -->
    <Button class="setting-item-content-item-value" :theme="props.theme">
      {{ $t(props.placeholder) }}
    </Button>
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
    width: 20%;
    left: 5%;
    top: 10px;
    text-align: left;
    --td-brand-color: var(--cp-accent);
    --td-radius-default: 10px;
}
</style>
