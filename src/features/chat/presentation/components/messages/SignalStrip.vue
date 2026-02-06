<script setup lang="ts">
/**
 * @fileoverview SignalStrip.vue
 * @description 消息行左侧的 2px domain 色条，用于快速识别消息所属域（domain）。
 */

const props = withDefaults(
  defineProps<{
    colorVar?: string;
  }>(),
  {
    colorVar: "--cp-domain-unknown",
  },
);
</script>

<template>
  <!-- 组件：SignalStrip｜职责：消息域色条（2px） -->
  <!-- 区块：<span> .cp-signal-strip -->
  <span class="cp-signal-strip" :style="{ background: `var(${props.colorVar})` }" aria-hidden="true"></span>
</template>

<style scoped lang="scss">
/* 样式：SignalStrip｜2px 垂直 domain 色条（高度跟随消息行） */
.cp-signal-strip {
  display: block;
  width: 2px;
  height: 100%;
  min-height: 18px;
  border-radius: 999px;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.10);
  flex: 0 0 auto;
}
</style>
