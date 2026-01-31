<script setup lang="ts">
/**
 * @fileoverview ServerManagerModal.vue 文件职责说明。
 */

import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { MessagePlugin } from "tdesign-vue-next";
import { getConnectServerUsecase } from "@/features/auth/di/connectServer.di";
import { useServerListStore, type ServerNotifyMode } from "@/features/servers/presentation/store/serverListStore";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("ServerManagerModal");
const { t } = useI18n();

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "update:open", value: boolean): void }>();

const { servers, upsertServer, removeServer, updateServer, setPinned, setNotifyMode } = useServerListStore();

const sortedServers = computed(() => {
  return [...servers].sort((a, b) => {
    const pinA = a.pinned ? 0 : 1;
    const pinB = b.pinned ? 0 : 1;
    if (pinA !== pinB) return pinA - pinB;
    return a.name.localeCompare(b.name);
  });
});

const form = reactive({
  socket: "",
  transport: "tls" as "tls" | "tls-insecure" | "tcp",
  name: "",
  note: "",
});

const loading = ref(false);

/**
 * close 方法说明。
 * @returns 返回值说明。
 */
function close() {
  emit("update:open", false);
}

/**
 * addServer 方法说明。
 * @returns 返回值说明。
 */
async function addServer() {
  const socket = form.socket.trim();
  if (!socket) {
    MessagePlugin.error(t("server_socket_required"));
    return;
  }

  loading.value = true;
  try {
    const connector = getConnectServerUsecase();
    await connector.execute({ serverSocket: normalizeSocketWithTransport(socket, form.transport) });
    upsertServer({
      socket: normalizeSocketWithTransport(socket, form.transport),
      name: form.name.trim() || socket,
      note: form.note.trim(),
      pinned: false,
      notifyMode: "notify",
    });
    MessagePlugin.success(t("server_added"));
    form.socket = "";
    form.transport = "tls";
    form.name = "";
    form.note = "";
  } catch (e) {
    logger.error("Connect server failed", { error: String(e) });
    MessagePlugin.error(t("server_connect_failed"));
  } finally {
    loading.value = false;
  }
}

/**
 * removeServerItem 方法说明。
 * @param socket - 参数说明。
 * @returns 返回值说明。
 */
function removeServerItem(socket: string) {
  removeServer(socket);
  if (currentServerSocket.value === socket) {
    setServerSocket("");
  }
}

/**
 * togglePin 方法说明。
 * @param socket - 参数说明。
 * @param next - 参数说明。
 * @returns 返回值说明。
 */
function togglePin(socket: string, next: boolean) {
  setPinned(socket, next);
}

/**
 * updateNotify 方法说明。
 * @param socket - 参数说明。
 * @param mode - 参数说明。
 * @returns 返回值说明。
 */
function updateNotify(socket: string, mode: ServerNotifyMode) {
  setNotifyMode(socket, mode);
}

/**
 * updateName 方法说明。
 * @param socket - 参数说明。
 * @param name - 参数说明。
 * @returns 返回值说明。
 */
function updateName(socket: string, name: string) {
  updateServer(socket, { name });
}

/**
 * updateNote 方法说明。
 * @param socket - 参数说明。
 * @param note - 参数说明。
 * @returns 返回值说明。
 */
function updateNote(socket: string, note: string) {
  updateServer(socket, { note });
}

/**
 * normalizeSocketWithTransport 方法说明。
 * @param raw - 参数说明。
 * @param transport - 参数说明。
 * @returns 返回值说明。
 */
function normalizeSocketWithTransport(raw: string, transport: "tls" | "tls-insecure" | "tcp"): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (transport === "tcp") return `tcp://${trimmed}`;
  if (transport === "tls-insecure") return `tls-insecure://${trimmed}`;
  return `tls://${trimmed}`;
}
</script>

<template>
  <!-- 组件：ServerManagerModal｜职责：服务器管理弹窗 -->
  <Teleport to="body">
    <!-- 区块：<div> .modal-overlay -->
    <div v-if="props.open" class="modal-overlay" @click.self="close">
      <!-- 区块：<div> .modal-content -->
      <div class="modal-content">
        <!-- 区块：<div> .header -->
        <div class="header">
          <!-- 区块：<div> .title -->
          <div class="title">{{ $t('server_manager') }}</div>
          <!-- 区块：<button> -->
          <button class="close-btn" type="button" @click="close">&times;</button>
        </div>

        <!-- 区块：<div> .form -->
        <div class="form">
          <!-- 区块：<div> .form-row -->
          <div class="form-row">
            <input class="cp-field" v-model="form.socket" type="text" :placeholder="$t('server_socket')" />
            <select class="cp-field" v-model="form.transport" aria-label="transport">
              <option value="tls">{{ $t('transport_tls_strict') }}</option>
              <option value="tls-insecure">{{ $t('transport_tls_insecure') }}</option>
              <option value="tcp">{{ $t('transport_tcp_legacy') }}</option>
            </select>
          </div>
          <!-- 区块：<div> .form-row -->
          <div class="form-row">
            <input class="cp-field" v-model="form.name" type="text" :placeholder="$t('server_name_placeholder')" />
            <input class="cp-field" v-model="form.note" type="text" :placeholder="$t('server_note_placeholder')" />
          </div>
          <!-- 区块：<button> -->
          <button class="btn primary" type="button" :disabled="loading" @click="addServer">
            {{ loading ? $t('loading') : $t('server_add') }}
          </button>
        </div>

        <!-- 区块：<div> .list -->
        <div class="list">
          <!-- 区块：<div> .server-item -->
          <div v-for="item in sortedServers" :key="item.socket" class="server-item">
            <!-- 区块：<div> .item-main -->
            <div class="item-main">
              <input
                class="name-input cp-field"
                :value="item.name"
                @input="updateName(item.socket, ($event.target as HTMLInputElement).value)"
              />
              <!-- 区块：<div> .socket -->
              <div class="socket">{{ item.socket }}</div>
              <input
                class="note-input cp-field"
                :value="item.note"
                :placeholder="$t('server_note_placeholder')"
                @input="updateNote(item.socket, ($event.target as HTMLInputElement).value)"
              />
            </div>
            <!-- 区块：<div> .item-actions -->
            <div class="item-actions">
              <label class="toggle">
                <input type="checkbox" :checked="item.pinned" @change="togglePin(item.socket, ($event.target as HTMLInputElement).checked)" />
                <span>{{ $t('pin_server') }}</span>
              </label>
              <select
                class="cp-field"
                :value="item.notifyMode"
                @change="updateNotify(item.socket, ($event.target as HTMLSelectElement).value as ServerNotifyMode)"
              >
                <option value="notify">{{ $t('settings_recv_notify') }}</option>
                <option value="silent">{{ $t('settings_recv_silent') }}</option>
                <option value="mute">{{ $t('settings_no_recv') }}</option>
              </select>
              <!-- 区块：<button> -->
              <button class="btn ghost" type="button" @click="removeServerItem(item.socket)">
                {{ $t('remove') }}
              </button>
            </div>
          </div>
          <!-- 区块：<div> .empty-tip -->
          <div v-if="!sortedServers.length" class="empty-tip">{{ $t('server_list_empty') }}</div>
        </div>
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
  padding: 24px;
  width: min(720px, 92vw);
  max-height: 80vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border: 1px solid var(--cp-border);
  box-shadow: var(--cp-shadow);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

/* 样式：.header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 样式：.title */
.title {
  font-size: 18px;
  font-weight: 600;
  color: var(--cp-text, #1a1a1a);
}

/* 样式：.close-btn */
.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.form */
.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 样式：.form-row */
.form-row {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

/* 样式：.form input */
.form .cp-field {
  font-size: 13px;
}

/* 样式：.btn */
.btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text, #1a1a1a);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast, 160ms) var(--cp-ease, ease),
    background-color var(--cp-fast, 160ms) var(--cp-ease, ease);

  &:hover {
    transform: translateY(-1px);
    background: var(--cp-hover-bg);
  }
}

/* 样式：.btn.primary */
.btn.primary {
  background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-hover));
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 18px 40px var(--cp-accent-shadow);
}

/* 样式：.btn.ghost */
.btn.ghost {
  background: transparent;
}

/* 样式：.list */
.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 样式：.server-item */
.server-item {
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius, 14px);
  padding: 12px;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
  background: var(--cp-panel-muted);
}

/* 样式：.item-main */
.item-main {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.name-input,
/* 样式：.note-input */
.note-input {
  width: 100%;
}

/* 样式：.socket */
.socket {
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.item-actions */
.item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 160px;
}

/* 样式：.toggle */
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--cp-text-muted, #737373);
}

/* 样式：.item-actions select */
.item-actions select {
  font-size: 12px;
  height: var(--cp-field-height);
}

/* 样式：.empty-tip */
.empty-tip {
  font-size: 13px;
  color: var(--cp-text-light, #a3a3a3);
  text-align: center;
  padding: 12px 0;
}
</style>
