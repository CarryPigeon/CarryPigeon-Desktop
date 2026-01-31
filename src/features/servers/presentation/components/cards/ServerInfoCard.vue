<script setup lang="ts">
/**
 * @fileoverview ServerInfoCard.vue 文件职责说明。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { useServerListStore } from "@/features/servers/presentation/store/serverListStore";
import DefaultAvatar from "/test_avatar.jpg?url";

const { t } = useI18n();
const emit = defineEmits<{
  (e: "open-info"): void;
}>();

const { servers } = useServerListStore();

const currentServer = computed(() =>
  servers.find((item) => item.socket === currentServerSocket.value),
);

const displayName = computed(() =>
  currentServer.value?.name || currentServerSocket.value || t("server_unknown"),
);
const displaySocket = computed(() =>
  currentServerSocket.value || t("server_not_connected"),
);
const displayBrief = computed(() =>
  currentServer.value?.brief || t("server_brief_placeholder"),
);
const displayOnline = computed(() => currentServer.value?.onlineCount ?? null);
const displayAvatar = computed(() => currentServer.value?.avatarUrl || DefaultAvatar);

/**
 * handleOpenInfo 方法说明。
 * @returns 返回值说明。
 */
function handleOpenInfo() {
  emit("open-info");
}
</script>

<template>
  <!-- 组件：ServerInfoCard｜职责：频道列表顶部服务器信息卡片 -->
  <!-- 区块：<button> -->
  <button class="server-card" type="button" @click="handleOpenInfo">
    <img class="server-avatar" :src="displayAvatar" alt="server" />
    <!-- 区块：<div> .server-meta -->
    <div class="server-meta">
      <!-- 区块：<div> .server-title -->
      <div class="server-title">{{ displayName }}</div>
      <!-- 区块：<div> .server-socket -->
      <div class="server-socket">{{ displaySocket }}</div>
      <!-- 区块：<div> .server-brief -->
      <div class="server-brief">{{ displayBrief }}</div>
    </div>
    <!-- 区块：<div> .server-online -->
    <div class="server-online">
      <span class="online-label">{{ $t('server_online') }}</span>
      <span class="online-value">
        {{ displayOnline === null ? "—" : displayOnline }}
      </span>
    </div>
  </button>
</template>

<style scoped lang="scss">
/* 样式：.server-card */
.server-card {
  border: none;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--cp-panel, #ffffff);
  border-bottom: 1px solid var(--cp-border-light, #edf0f3);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;

  /* 样式：&:hover */
  &:hover {
    background: var(--cp-panel-muted, #eef1f4);
  }
}

/* 样式：.server-avatar */
.server-avatar {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  background: #e5e5e5;
  flex-shrink: 0;
}

/* 样式：.server-meta */
.server-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 样式：.server-title */
.server-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.server-socket */
.server-socket {
  font-size: 11px;
  color: var(--cp-text-muted, #737373);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.server-brief */
.server-brief {
  font-size: 11px;
  color: var(--cp-text-light, #a3a3a3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.server-online */
.server-online {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 11px;
  color: var(--cp-text-muted, #737373);
  flex-shrink: 0;
}

/* 样式：.online-label */
.online-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 9px;
}

/* 样式：.online-value */
.online-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text, #1a1a1a);
}
</style>
