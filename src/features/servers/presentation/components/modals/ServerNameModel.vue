<script setup lang="ts">
/**
 * @fileoverview ServerNameModel.vue 文件职责说明。
 */

import { computed } from "vue";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";

const props = defineProps<{
  serverName?: string;
  onlineNumber?: number;
}>();

const displayServerName = computed(() => props.serverName?.trim() || currentServerSocket.value || "Not connected");
const displayOnlineNumber = computed(() => (typeof props.onlineNumber === "number" ? props.onlineNumber : null));
</script>

<template>
  <!-- 组件：ServerNameModel｜职责：显示当前服务器名与在线人数；变量：--channel-list-width -->
  <!-- 区块：<div> .serverNameModel -->
  <div class="serverNameModel">
    <p class="serverName">{{ displayServerName }}</p>
    <p v-if="displayOnlineNumber !== null" class="onlineNumber">
      {{ displayOnlineNumber }} 人在线
    </p>
  </div>
</template>

<style scoped lang="scss">
/* 样式：频道列表顶部标题栏 - 简洁白色风格 */
.serverNameModel {
  position: relative;
  width: 100%;
  height: 48px;
  background: var(--cp-panel, #ffffff);
  border-bottom: 1px solid var(--cp-border, #e5e5e5);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 12px;
}

/* 样式：.serverName */
.serverName {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--cp-text, #1a1a1a);
  text-align: left;
}

/* 样式：.onlineNumber */
.onlineNumber {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}
</style>
