<script setup lang="ts">
/**
 * @fileoverview ServerInfoModal.vue 文件职责说明。
 */

import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { currentServerSocket } from "@/features/servers/presentation/store/currentServer";
import { createServerDataService } from "@/features/servers/data/serverServiceFactory";
import { useServerListStore } from "@/features/servers/presentation/store/serverListStore";
import DefaultAvatar from "/test_avatar.jpg?url";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("ServerInfoModal");
const { t } = useI18n();

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "update:open", value: boolean): void }>();

const loading = ref(false);
const error = ref<string | null>(null);
const serverName = ref("");
const serverAvatar = ref("");
const serverBrief = ref("");

const { setServerInfo } = useServerListStore();

const displaySocket = computed(() => currentServerSocket.value || t("server_not_connected"));
const displayAvatar = computed(() => serverAvatar.value || DefaultAvatar);
const displayName = computed(() => serverName.value || currentServerSocket.value || t("server_unknown"));
const displayBrief = computed(() => serverBrief.value || t("server_brief_placeholder"));

/**
 * close 方法说明。
 * @returns 返回值说明。
 */
function close() {
  emit("update:open", false);
}

/**
 * fetchServerInfo 方法说明。
 * @returns 返回值说明。
 */
async function fetchServerInfo() {
  if (!currentServerSocket.value) {
    error.value = t("server_not_connected");
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const service = createServerDataService(currentServerSocket.value);
    const data = await service.getServerData();
    serverName.value = data.server_name ?? "";
    serverAvatar.value = data.avatar ?? "";
    serverBrief.value = data.brief ?? "";

    setServerInfo(currentServerSocket.value, {
      name: serverName.value || currentServerSocket.value,
      avatarUrl: serverAvatar.value || undefined,
      brief: serverBrief.value || "",
    });
  } catch (e) {
    logger.error("Load server info failed", { error: String(e) });
    error.value = t("server_info_load_failed");
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void fetchServerInfo();
  },
);
</script>

<template>
  <!-- 组件：ServerInfoModal｜职责：展示服务器信息弹窗 -->
  <Teleport to="body">
    <!-- 区块：<div> .modal-overlay -->
    <div v-if="props.open" class="modal-overlay" @click.self="close">
      <!-- 区块：<div> .modal-content -->
      <div class="modal-content">
        <!-- 区块：<button> -->
        <button class="close-btn" type="button" @click="close">&times;</button>

        <!-- 区块：<div> .header -->
        <div class="header">
          <img class="avatar" :src="displayAvatar" alt="server" />
          <!-- 区块：<div> .meta -->
          <div class="meta">
            <!-- 区块：<div> .name -->
            <div class="name">{{ displayName }}</div>
            <!-- 区块：<div> .socket -->
            <div class="socket">{{ displaySocket }}</div>
          </div>
        </div>

        <!-- 区块：<div> .brief -->
        <div class="brief">{{ displayBrief }}</div>

        <!-- 区块：<div> .status -->
        <div v-if="loading" class="status">{{ $t('loading') }}</div>
        <!-- 区块：<div> .status -->
        <div v-else-if="error" class="status error">{{ error }}</div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：.modal-overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--td-mask-active, rgba(0, 0, 0, 0.45));
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20000;
}

/* 样式：.modal-content */
.modal-content {
  background: var(--cp-panel, rgba(17, 24, 39, 0.78));
  border-radius: 22px;
  padding: 28px;
  width: 360px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  box-shadow: var(--cp-shadow);
  border: 1px solid var(--cp-border);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* 样式：.close-btn */
.close-btn {
  position: absolute;
  top: 12px;
  right: 16px;
  background: none;
  border: none;
  font-size: 20px;
  color: var(--cp-text-muted, #737373);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: background-color var(--cp-fast, 160ms) var(--cp-ease, ease);
  border-radius: 12px;

  &:hover {
    background: var(--cp-hover-bg);
  }
}

/* 样式：.header */
.header {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* 样式：.avatar */
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--cp-hover-bg);
  object-fit: cover;
  border: 1px solid var(--cp-border-light);
}

/* 样式：.meta */
.meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* 样式：.name */
.name {
  font-size: 16px;
  font-weight: 600;
  color: var(--cp-text, rgba(248, 250, 252, 0.92));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.socket */
.socket {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 样式：.brief */
.brief {
  font-size: 13px;
  color: var(--cp-text, rgba(248, 250, 252, 0.92));
  background: var(--cp-hover-bg);
  padding: 12px;
  border-radius: var(--cp-radius, 14px);
  min-height: 60px;
  border: 1px solid var(--cp-border-light);
}

/* 样式：.status */
.status {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.status.error */
.status.error {
  color: var(--cp-danger);
}
</style>
