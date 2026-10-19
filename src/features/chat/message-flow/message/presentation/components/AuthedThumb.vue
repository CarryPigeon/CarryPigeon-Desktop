<script setup lang="ts">
/**
 * @fileoverview AuthedThumb.vue
 * @description message-flow/message｜需要 Bearer 鉴权的缩略图组件。
 *
 * 用途：在 v-for 列表中为受鉴权保护的资源 URL 生成 objectURL 后渲染 `<img>`，
 * 避免浏览器原生 `<img>` 无法附加 `Authorization` header 导致 401。
 */

import { useAuthedObjectUrl } from "@/shared/file-transfer/useAuthedObjectUrl";

const props = defineProps<{
  /**
   * 资源 URL（受 Bearer 鉴权保护）。
   */
  url: string;
  /**
   * 服务端 socket，用于推导 access token。
   */
  serverSocket: string;
  /**
   * 图片 alt 文本。
   */
  alt?: string;
}>();

const { objectUrl, loading, error } = useAuthedObjectUrl(
  () => props.url,
  () => props.serverSocket,
);

void error;
</script>

<template>
  <img
    v-if="objectUrl"
    :src="objectUrl"
    :alt="alt"
    class="cp-authedThumb__img"
  />
  <span v-else-if="loading" class="cp-authedThumb__placeholder">…</span>
  <span v-else class="cp-authedThumb__placeholder cp-authedThumb__placeholder--err">!</span>
</template>

<style scoped lang="scss">
/* 样式：AuthedThumb｜规格：鉴权缩略图占位（面板底 + 状态色） */
.cp-authedThumb__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cp-authedThumb__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 11px;
  color: var(--cp-text-muted);
  background: var(--cp-panel-muted);
}

.cp-authedThumb__placeholder--err {
  color: var(--cp-danger);
}
</style>
