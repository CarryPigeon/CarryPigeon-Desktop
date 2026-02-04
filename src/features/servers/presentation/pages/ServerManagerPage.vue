<script setup lang="ts">
/**
 * @fileoverview ServerManagerPage.vue
 * @description Server rack manager (/servers) — add/edit/delete/pin racks and configure per-server preview options.
 *
 * PRD mapping:
 * - P0-S1 服务器管理：新增/编辑/删除服务器条目（socket、备注名、TLS 信任策略、通知模式）。
 *
 * Clean Architecture note:
 * This page is presentation-only and edits the presentation store
 * `src/features/servers/presentation/store/serverList.ts`.
 * Real persistence (DB) can be wired behind a port later; the UI contract stays stable.
 */

import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { createLogger } from "@/shared/utils/logger";
import MonoTag from "@/shared/ui/MonoTag.vue";
import {
  addServer,
  removeServerById,
  serverRacks,
  togglePinServerById,
  updateServerRack,
  type ServerRack,
} from "../store/serverList";
import { currentServerSocket, setServerSocket } from "@/features/servers/presentation/store/currentServer";

type DraftRack = {
  id: string;
  name: string;
  serverSocket: string;
  note: string;
  tlsPolicy: ServerRack["tlsPolicy"];
  tlsFingerprint: ServerRack["tlsFingerprint"];
  notifyMode: ServerRack["notifyMode"];
};

const logger = createLogger("ServerManagerPage");
const { t } = useI18n();
const router = useRouter();

const creating = reactive({
  name: "",
  serverSocket: "",
});

const editingId = ref<string>("");
const draft = reactive<DraftRack>({
  id: "",
  name: "",
  serverSocket: "",
  note: "",
  tlsPolicy: "strict",
  tlsFingerprint: "",
  notifyMode: "notify",
});

/**
 * Normalize a TLS certificate fingerprint string into a compact hex form.
 *
 * Accepts common formats:
 * - `AA:BB:...`
 * - `aa bb ...`
 * - `aabb...`
 *
 * @param raw - Raw fingerprint input.
 * @returns Normalized lowercase hex without separators (may be empty).
 */
function normalizeFingerprint(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  const hex = s.replace(/[^0-9a-f]/g, "");
  return hex;
}

/**
 * Compute the active server socket currently selected for preview.
 *
 * @returns Trimmed socket string.
 */
function computeActiveSocket(): string {
  return currentServerSocket.value.trim();
}

const activeSocket = computed(computeActiveSocket);

/**
 * Start editing a rack by copying its fields into the local draft buffer.
 *
 * @param rack - Rack to edit.
 */
function beginEdit(rack: ServerRack): void {
  editingId.value = rack.id;
  draft.id = rack.id;
  draft.name = rack.name;
  draft.serverSocket = rack.serverSocket;
  draft.note = rack.note;
  draft.tlsPolicy = rack.tlsPolicy;
  draft.tlsFingerprint = rack.tlsFingerprint;
  draft.notifyMode = rack.notifyMode;
}

/**
 * Exit edit mode and clear the draft buffer.
 */
function cancelEdit(): void {
  editingId.value = "";
  draft.id = "";
  draft.name = "";
  draft.serverSocket = "";
  draft.note = "";
  draft.tlsPolicy = "strict";
  draft.tlsFingerprint = "";
  draft.notifyMode = "notify";
}

/**
 * Apply the current draft edits to the underlying rack store.
 *
 * @returns `true` when saved successfully.
 */
function saveEdit(): boolean {
  if (!editingId.value) return false;
  const ok = updateServerRack(editingId.value, {
    name: draft.name,
    serverSocket: draft.serverSocket,
    note: draft.note,
    tlsPolicy: draft.tlsPolicy,
    tlsFingerprint: normalizeFingerprint(draft.tlsFingerprint),
    notifyMode: draft.notifyMode,
  });
  if (!ok) {
    logger.warn("Update rack rejected", {
      id: editingId.value,
      serverSocket: draft.serverSocket,
    });
    return false;
  }
  cancelEdit();
  return true;
}

/**
 * Add a new rack from the create form and focus it as the active server.
 */
function handleCreate(): void {
  const socket = creating.serverSocket.trim();
  if (!socket) return;
  addServer(socket, creating.name.trim());
  logger.info("Server added", { socket });
  creating.name = "";
  creating.serverSocket = "";
}

/**
 * Remove a rack and keep the UI stable (exit edit mode if deleting the edited row).
 *
 * @param id - Rack id.
 */
function handleRemove(id: string): void {
  if (editingId.value === id) cancelEdit();
  const list = serverRacks.value;
  let rack: (typeof list)[number] | null = null;
  for (const item of list) {
    if (item.id === id) {
      rack = item;
      break;
    }
  }
  removeServerById(id);
  logger.info("Server removed", { id, socket: rack?.serverSocket ?? "" });
}

/**
 * Select a rack as the current active server for preview.
 *
 * @param socket - Target server socket.
 */
function selectRack(socket: string): void {
  setServerSocket(socket);
}

/**
 * Watch-source: active socket.
 *
 * @returns Current active socket.
 */
function watchActiveSocket(): string {
  return activeSocket.value;
}

/**
 * When changing racks, avoid leaving stale edit buffers around.
 *
 * @returns void
 */
function handleActiveSocketChange(): void {
  if (editingId.value) cancelEdit();
}

watch(watchActiveSocket, handleActiveSocketChange);
</script>

<template>
  <!-- 页面：ServerManagerPage｜职责：服务器管理（新增/编辑/删除/置顶/策略）｜交互：编辑行、保存/取消、选择当前 rack -->
  <!-- 区块：<main> .cp-servers -->
  <main class="cp-servers">
    <!-- Header -->
    <header class="cp-servers__head">
      <!-- 返回 -->
      <button class="cp-servers__back" type="button" @click="router.back()">Back</button>
      <!-- 标题 -->
      <div class="cp-servers__title">
        <div class="cp-servers__name">{{ t("server_manager") }}</div>
        <div class="cp-servers__sub">Racks · TLS policy · Notify mode</div>
      </div>
      <!-- 当前 socket -->
      <div class="cp-servers__active">
        <div class="cp-servers__activeK">active</div>
        <MonoTag :value="activeSocket || '—'" title="current server socket" :copyable="true" />
      </div>
    </header>

    <!-- Create -->
    <section class="cp-servers__create">
      <!-- 新增表单 -->
      <div class="cp-servers__createTitle">Add rack</div>
      <div class="cp-servers__createGrid">
        <div class="cp-servers__field">
          <div class="cp-servers__label">{{ t("server_name_placeholder") }}</div>
          <t-input v-model="creating.name" placeholder="Mock Rack" clearable />
        </div>
        <div class="cp-servers__field wide">
          <div class="cp-servers__label">{{ t("server_socket_required") }}</div>
          <t-input v-model="creating.serverSocket" placeholder="tls://host:port or mock://handshake" clearable />
        </div>
        <div class="cp-servers__actions">
          <button class="cp-servers__btn primary" type="button" @click="handleCreate">{{ t("server_add") }}</button>
          <button class="cp-servers__btn" type="button" @click="$router.push('/chat')">Open Patchbay</button>
        </div>
      </div>
    </section>

    <!-- List -->
    <section class="cp-servers__listWrap">
      <!-- 服务器列表 -->
      <header class="cp-servers__listHead">
        <div class="cp-servers__listTitle">Rack list</div>
        <div class="cp-servers__listMeta">
          <span class="cp-servers__muted">count</span>
          <span class="cp-servers__mono">{{ serverRacks.length }}</span>
        </div>
      </header>

      <div class="cp-servers__list">
        <article
          v-for="rack in serverRacks"
          :key="rack.id"
          class="cp-rackRow"
          :data-active="rack.serverSocket === activeSocket"
        >
          <!-- 选择当前 rack -->
          <button class="cp-rackRow__select" type="button" @click="selectRack(rack.serverSocket)">
            <span class="cp-rackRow__led" aria-hidden="true"></span>
            <span class="cp-rackRow__selectText">Use</span>
          </button>

          <!-- 内容 -->
          <div class="cp-rackRow__body">
            <div class="cp-rackRow__top">
              <div class="cp-rackRow__name">{{ rack.name }}</div>
              <div class="cp-rackRow__tags">
                <MonoTag :value="rack.serverSocket" title="server socket" :copyable="true" />
                <span v-if="rack.pinned" class="cp-rackRow__pill">PINNED</span>
              </div>
            </div>

            <div v-if="editingId !== rack.id" class="cp-rackRow__meta">
              <div class="cp-rackRow__kv">
                <span class="cp-rackRow__k">tls</span>
                <span class="cp-rackRow__v">{{ rack.tlsPolicy }}</span>
              </div>
              <div v-if="rack.tlsPolicy === 'trust_fingerprint' && rack.tlsFingerprint" class="cp-rackRow__kv wide">
                <span class="cp-rackRow__k">fp</span>
                <span class="cp-rackRow__v">{{ rack.tlsFingerprint.slice(0, 12) }}…</span>
              </div>
              <div class="cp-rackRow__kv">
                <span class="cp-rackRow__k">notify</span>
                <span class="cp-rackRow__v">{{ rack.notifyMode }}</span>
              </div>
              <div v-if="rack.note" class="cp-rackRow__kv wide">
                <span class="cp-rackRow__k">note</span>
                <span class="cp-rackRow__v">{{ rack.note }}</span>
              </div>
            </div>

            <!-- 编辑态 -->
            <div v-else class="cp-rackRow__edit">
              <div class="cp-rackRow__editGrid">
                <div class="cp-rackRow__field">
                  <div class="cp-rackRow__label">name</div>
                  <t-input v-model="draft.name" clearable />
                </div>
                <div class="cp-rackRow__field">
                  <div class="cp-rackRow__label">socket</div>
                  <t-input v-model="draft.serverSocket" clearable />
                </div>
                <div class="cp-rackRow__field">
                  <div class="cp-rackRow__label">tls policy</div>
                  <t-select v-model="draft.tlsPolicy">
                    <t-option value="strict" label="strict (default)" />
                    <t-option value="trust_fingerprint" label="trust_fingerprint" />
                    <t-option value="insecure" label="insecure (dev only)" />
                  </t-select>
                </div>
                <div v-if="draft.tlsPolicy === 'trust_fingerprint'" class="cp-rackRow__field wide">
                  <div class="cp-rackRow__label">tls fingerprint (sha256)</div>
                  <t-input v-model="draft.tlsFingerprint" placeholder="64 hex chars (colons/spaces ok)" clearable />
                </div>
                <div class="cp-rackRow__field">
                  <div class="cp-rackRow__label">notify mode</div>
                  <t-select v-model="draft.notifyMode">
                    <t-option value="notify" :label="t('settings_recv_notify')" />
                    <t-option value="silent" :label="t('settings_recv_silent')" />
                    <t-option value="none" :label="t('settings_no_recv')" />
                  </t-select>
                </div>
                <div class="cp-rackRow__field wide">
                  <div class="cp-rackRow__label">note</div>
                  <t-input v-model="draft.note" placeholder="Optional note…" />
                </div>
              </div>

              <div class="cp-rackRow__editActions">
                <button class="cp-rackRow__btn primary" type="button" @click="saveEdit">Save</button>
                <button class="cp-rackRow__btn" type="button" @click="cancelEdit">Cancel</button>
              </div>
            </div>
          </div>

          <!-- 操作 -->
          <div class="cp-rackRow__ops">
            <button class="cp-rackRow__op" type="button" @click="togglePinServerById(rack.id)">{{ t("pin_server") }}</button>
            <button v-if="editingId !== rack.id" class="cp-rackRow__op" type="button" @click="beginEdit(rack)">{{ t("edit") }}</button>
            <button class="cp-rackRow__op danger" type="button" @click="handleRemove(rack.id)">{{ t("remove") }}</button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* 样式：服务器管理页｜布局策略：header + create + list｜关键变量：--cp-* token｜约束：列表可滚动、编辑栅格自适应 */

/* Page wrapper */
.cp-servers {
  height: 100%;
  padding: 14px;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 12px;
}

/* Header */
.cp-servers__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

/* Back button */
.cp-servers__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Back hover */
.cp-servers__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Title block */
.cp-servers__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Subtitle */
.cp-servers__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Active chip block */
.cp-servers__active {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

/* Active label */
.cp-servers__activeK {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Create panel */
.cp-servers__create {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
}

/* Create title */
.cp-servers__createTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Create grid */
.cp-servers__createGrid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 12px;
  align-items: end;
}

/* Field wrapper */
.cp-servers__field {
  min-width: 0;
}

/* Wide field */
.cp-servers__field.wide {
  grid-column: span 2;
}

/* Field label */
.cp-servers__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Create actions */
.cp-servers__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* Buttons */
.cp-servers__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 9px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Primary create button */
.cp-servers__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel));
}

/* Button hover */
.cp-servers__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* List panel */
.cp-servers__listWrap {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* List header */
.cp-servers__listHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

/* List title */
.cp-servers__listTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* List meta */
.cp-servers__listMeta {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

/* Muted label */
.cp-servers__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Mono number */
.cp-servers__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
}

/* List container */
.cp-servers__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Rack row */
.cp-rackRow {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: start;
}

/* Active row */
.cp-rackRow[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: color-mix(in oklab, var(--cp-highlight) 10%, var(--cp-panel));
}

/* Select button */
.cp-rackRow__select {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Select hover */
.cp-rackRow__select:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* LED */
.cp-rackRow__led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-accent) 18%, transparent);
}

/* Select text */
.cp-rackRow__selectText {
  font-family: var(--cp-font-display);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* Row body */
.cp-rackRow__body {
  min-width: 0;
}

/* Row header */
.cp-rackRow__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

/* Row name */
.cp-rackRow__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 14px;
  color: var(--cp-text);
}

/* Tag row */
.cp-rackRow__tags {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Small pill */
.cp-rackRow__pill {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text);
  border: 1px solid color-mix(in oklab, var(--cp-warn) 36%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-warn) 14%, transparent);
  border-radius: 999px;
  padding: 4px 8px;
}

/* Meta row */
.cp-rackRow__meta {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

/* Key-value item */
.cp-rackRow__kv {
  display: inline-flex;
  gap: 8px;
  align-items: baseline;
}

/* Wide kv */
.cp-rackRow__kv.wide {
  flex: 1 1 100%;
  min-width: 0;
}

/* KV key */
.cp-rackRow__k {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* KV value */
.cp-rackRow__v {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

/* Edit wrapper */
.cp-rackRow__edit {
  margin-top: 12px;
}

/* Edit grid */
.cp-rackRow__editGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

/* Edit field */
.cp-rackRow__field {
  min-width: 0;
}

/* Wide edit field */
.cp-rackRow__field.wide {
  grid-column: 1 / -1;
}

/* Edit labels */
.cp-rackRow__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Edit actions */
.cp-rackRow__editActions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  flex-wrap: wrap;
}

/* Edit buttons */
.cp-rackRow__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Edit primary */
.cp-rackRow__btn.primary {
  border-color: color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 12%, var(--cp-panel));
}

/* Edit hover */
.cp-rackRow__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Ops column */
.cp-rackRow__ops {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Op buttons */
.cp-rackRow__op {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Op hover */
.cp-rackRow__op:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Danger op */
.cp-rackRow__op.danger {
  border-color: color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
}
</style>
