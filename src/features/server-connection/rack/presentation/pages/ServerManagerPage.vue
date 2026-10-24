<script setup lang="ts">
/**
 * @fileoverview ServerManagerPage.vue
 * @description server-connection/rack｜页面：ServerManagerPage。
 *
 * PRD 对照：
 * - P0-S1 服务器管理：新增/编辑/删除服务器条目（socket、备注名、TLS 信任策略、通知模式）。
 *
 * 分层说明（Clean Architecture）：
 * - 本页面仅负责展示层交互，直接编辑展示层 store：`src/features/server-connection/rack/presentation/store/serverList.ts`。
 * - 若后续需要接入真实持久化（DB），可通过端口抽象完成替换，UI 契约保持稳定。
 */

import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { createLogger } from "@/shared/utils/logger";
import { toast } from "@/shared/utils/toast";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { useCurrentWorkspaceMaintenance } from "@/features/server-connection/scope-lifecycle/presentation/composables/useCurrentWorkspaceMaintenance";
import { useServerLogout } from "../composables/useServerLogout";
import {
  addServer,
  currentServerSocket,
  removeServerById,
  setServerSocket,
  serverRacks,
  togglePinServerById,
  updateServerRack,
  type ServerRack,
} from "../store";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';
import PageHeader from '@/shared/ui/PageHeader.vue';

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
const {
  clearConfirm,
  clearing,
  clearError,
  clearConfirmToken,
  socket: maintenanceSocket,
  knownServerId,
  scopeKey,
  clearCurrentWorkspaceLocalData,
} = useCurrentWorkspaceMaintenance();
const clearConfirmPlaceholder = computed(() => t("clear_confirm_placeholder", { token: clearConfirmToken }));

const { loggingOut, logoutServer } = useServerLogout();
/** 正在确认退出登录的服务器条目。 */
const logoutTarget = ref<ServerRack | null>(null);
const showLogoutConfirm = ref(false);
const logoutError = ref("");

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

function resetDraft(): void {
  draft.id = "";
  draft.name = "";
  draft.serverSocket = "";
  draft.note = "";
  draft.tlsPolicy = "strict";
  draft.tlsFingerprint = "";
  draft.notifyMode = "notify";
}

function applyRackToDraft(rack: ServerRack): void {
  draft.id = rack.id;
  draft.name = rack.name;
  draft.serverSocket = rack.serverSocket;
  draft.note = rack.note;
  draft.tlsPolicy = rack.tlsPolicy;
  draft.tlsFingerprint = rack.tlsFingerprint;
  draft.notifyMode = rack.notifyMode;
}

/**
 * 归一化 TLS 证书指纹字符串为紧凑的 hex 格式。
 *
 * 支持常见输入格式：
 * - `AA:BB:...`
 * - `aa bb ...`
 * - `aabb...`
 *
 * @param raw - 原始指纹输入。
 * @returns 小写 hex 串（去除分隔符；可能为空）。
 */
function normalizeFingerprint(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";
  const hex = s.replace(/[^0-9a-f]/g, "");
  return hex;
}

/**
 * 计算当前用于预览/连接的 active server socket。
 *
 * @returns trim 后的 socket 字符串。
 */
function computeActiveSocket(): string {
  return currentServerSocket.value.trim();
}

const activeSocket = computed(computeActiveSocket);

/**
 * 开始编辑某个 rack：将字段拷贝到本地 draft 缓冲区。
 *
 * @param rack - 需要编辑的 rack。
 */
function beginEdit(rack: ServerRack): void {
  editingId.value = rack.id;
  applyRackToDraft(rack);
}

/**
 * 退出编辑态并清空 draft 缓冲区。
 */
function cancelEdit(): void {
  editingId.value = "";
  resetDraft();
}

/**
 * 将当前 draft 的修改应用到 rack store。
 *
 * @returns 保存成功则为 `true`。
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
    logger.warn("Action: servers_rack_update_rejected", {
      id: editingId.value,
      serverSocket: draft.serverSocket,
    });
    return false;
  }
  cancelEdit();
  return true;
}

/**
 * 从“新增表单”添加 rack，并将其作为当前 active server（用于预览/连接）。
 */
function handleCreate(): void {
  const socket = creating.serverSocket.trim();
  if (!socket) return;
  addServer(socket, creating.name.trim());
  logger.info("Action: servers_server_added", { socket });
  creating.name = "";
  creating.serverSocket = "";
}

/**
 * 删除 rack，并保持 UI 稳定（若删除的是当前编辑行，则先退出编辑态）。
 *
 * @param id - rack id。
 */
function handleRemove(id: string): void {
  if (editingId.value === id) cancelEdit();
  const rack = serverRacks.value.find((item) => item.id === id) ?? null;
  removeServerById(id);
  logger.info("Action: servers_server_removed", { id, socket: rack?.serverSocket ?? "" });
  if (serverRacks.value.length === 0) {
    void router.replace("/login");
  }
}

async function handleClearWorkspace(): Promise<void> {
  await clearCurrentWorkspaceLocalData();
  if (!clearError.value) {
    void router.replace("/login");
  }
}

/**
 * 打开「退出登录」确认弹窗。
 *
 * @param rack - 目标服务器条目。
 */
function requestLogout(rack: ServerRack): void {
  logoutTarget.value = rack;
  logoutError.value = "";
  showLogoutConfirm.value = true;
}

/**
 * 确认退出登录：吊销该服务器 token 并清理其本地会话。
 *
 * 说明：退出的是当前活动服务器时回到登录页；退出其它服务器时仅清空该服务器的登录态，保留条目。
 */
async function handleLogout(): Promise<void> {
  const rack = logoutTarget.value;
  if (!rack) return;
  const socket = rack.serverSocket.trim();
  if (!socket) {
    showLogoutConfirm.value = false;
    return;
  }

  const outcome = await logoutServer(socket);
  if (!outcome.ok) {
    // 保持弹窗打开，让错误可见
    logoutError.value = outcome.error || t("servers_logout_failed");
    toast.error(t("servers_logout_failed"));
    return;
  }

  showLogoutConfirm.value = false;
  if (outcome.activeSessionCleared) {
    void router.replace("/login");
    return;
  }
  toast.success(t("servers_logout_done"));
}

/**
 * 选择某个 rack 作为当前 active server（用于预览/连接）。
 *
 * @param socket - 目标服务器 Socket 地址。
 */
function selectRack(socket: string): void {
  setServerSocket(socket);
}

/**
 * 判断 rack 行是否还有可展示的补充信息（仅保留条件性信息：TLS 指纹、备注）。
 *
 * 说明：TLS 策略与通知模式属于编辑态配置项，展示行不再重复渲染，避免信息冗余。
 *
 * @param rack - 服务器条目。
 * @returns 存在可展示补充信息时为 `true`。
 */
function hasRackDetails(rack: ServerRack): boolean {
  return Boolean((rack.tlsPolicy === "trust_fingerprint" && rack.tlsFingerprint) || rack.note);
}

/**
 * watch 源：active socket。
 *
 * @returns 当前 active socket。
 */
function watchActiveSocket(): string {
  return activeSocket.value;
}

/**
 * 当 active rack 变化时，避免遗留过期的编辑缓冲区。
 *
 * @returns 无返回值。
 */
function handleActiveSocketChange(): void {
  if (editingId.value) cancelEdit();
}

watch(watchActiveSocket, handleActiveSocketChange);

// 关闭弹窗时清理退出登录上下文与错误提示
watch(showLogoutConfirm, (visible) => {
  if (visible) return;
  logoutTarget.value = null;
  logoutError.value = "";
});
</script>

<template>
  <!-- 页面：ServerManagerPage｜职责：服务器管理（新增/编辑/删除/置顶/策略）｜交互：编辑行、保存/取消、选择当前 rack -->
  <!-- 区块：<main> .cp-servers -->
  <main class="cp-servers">
    <ErrorBoundary>
      <!-- Header -->
      <PageHeader
        :title="t('server_manager')"
        back
        :back-label="t('back')"
        data-testid="servers-header"
        @back="router.back()"
      >
        <template #actions>
          <div class="cp-servers__active">
            <div class="cp-servers__activeK">{{ t("servers_active_label") }}</div>
            <MonoTag :value="activeSocket || '—'" :title="t('current_server_socket')" :copyable="true" />
          </div>
        </template>
      </PageHeader>

      <!-- Create -->
      <section class="cp-servers__create">
        <!-- 新增表单 -->
        <div class="cp-servers__createTitle">{{ t("servers_add_rack") }}</div>
        <div class="cp-servers__createGrid">
          <div class="cp-servers__field">
            <div class="cp-servers__label">{{ t("server_name_placeholder") }}</div>
            <t-input v-model="creating.name" :placeholder="t('server_name_placeholder')" clearable />
          </div>
          <div class="cp-servers__field wide">
            <div class="cp-servers__label">{{ t("server_socket_required") }}</div>
            <t-input v-model="creating.serverSocket" clearable />
          </div>
          <div class="cp-servers__actions">
            <button class="cp-servers__btn primary" type="button" @click="handleCreate">{{ t("server_add") }}</button>
          </div>
        </div>
      </section>

      <section class="cp-servers__maintenance">
        <div class="cp-servers__createTitle">{{ t("workspace_maintenance") }}</div>
        <div class="cp-servers__maintenanceGrid">
          <div class="cp-servers__field">
            <div class="cp-servers__label">{{ t("server_socket_label") }}</div>
            <MonoTag :value="maintenanceSocket || '—'" :title="t('server_socket_label')" :copyable="true" />
          </div>
          <div class="cp-servers__field">
            <div class="cp-servers__label">{{ t("known_server_id") }}</div>
            <MonoTag :value="knownServerId || '—'" :title="t('known_server_id')" :copyable="true" />
          </div>
          <div class="cp-servers__field">
            <div class="cp-servers__label">{{ t("scope_key") }}</div>
            <MonoTag :value="scopeKey || '—'" :title="t('scope_key_title')" :copyable="true" />
          </div>
          <div class="cp-servers__field wide">
            <div class="cp-servers__label">{{ t("local_cleanup") }}</div>
            <div class="cp-servers__maintenanceHint">
              {{ t("local_cleanup_desc") }}
            </div>
          </div>
          <div class="cp-servers__field wide">
            <div class="cp-servers__maintenanceActions">
              <t-input v-model="clearConfirm" :placeholder="clearConfirmPlaceholder" clearable />
              <button class="cp-servers__btn danger" type="button" :disabled="clearing" @click="handleClearWorkspace">
                {{ clearing ? t("clearing") : t("clear_workspace_data") }}
              </button>
            </div>
            <div v-if="clearError" class="cp-servers__error">{{ clearError }}</div>
          </div>
        </div>
      </section>

      <!-- List -->
      <section class="cp-servers__listWrap">
        <!-- 服务器列表 -->
        <header class="cp-servers__listHead">
          <div class="cp-servers__listTitle">{{ t("rack_list") }}</div>
          <div class="cp-servers__listMeta">
            <span class="cp-servers__muted">{{ t("rack_list_count") }}</span>
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
              <span class="cp-rackRow__selectText">{{ t("rack_use") }}</span>
            </button>

            <!-- 内容 -->
            <div class="cp-rackRow__body">
              <div class="cp-rackRow__top">
                <div class="cp-rackRow__name">{{ rack.name }}</div>
                <div class="cp-rackRow__tags">
                  <MonoTag :value="rack.serverSocket" :title="t('server_socket_label')" :copyable="true" />
                  <span v-if="rack.pinned" class="cp-rackRow__pill">{{ t("rack_pinned") }}</span>
                </div>
              </div>

              <!-- 展示态：仅保留条件性补充信息（TLS 指纹 / 备注） -->
              <template v-if="editingId !== rack.id">
                <div v-if="hasRackDetails(rack)" class="cp-rackRow__meta">
                  <div v-if="rack.tlsPolicy === 'trust_fingerprint' && rack.tlsFingerprint" class="cp-rackRow__kv wide">
                    <span class="cp-rackRow__k">{{ t("rack_kv_fp") }}</span>
                    <span class="cp-rackRow__v">{{ rack.tlsFingerprint.slice(0, 12) }}…</span>
                  </div>
                  <div v-if="rack.note" class="cp-rackRow__kv wide">
                    <span class="cp-rackRow__k">{{ t("rack_kv_note") }}</span>
                    <span class="cp-rackRow__v">{{ rack.note }}</span>
                  </div>
                </div>
              </template>

              <!-- 编辑态 -->
              <div v-else class="cp-rackRow__edit">
                <div class="cp-rackRow__editGrid">
                  <div class="cp-rackRow__field">
                    <div class="cp-rackRow__label">{{ t("rack_edit_name") }}</div>
                    <t-input v-model="draft.name" clearable />
                  </div>
                  <div class="cp-rackRow__field">
                    <div class="cp-rackRow__label">{{ t("rack_edit_socket") }}</div>
                    <t-input v-model="draft.serverSocket" clearable />
                  </div>
                  <div class="cp-rackRow__field">
                    <div class="cp-rackRow__label">{{ t("rack_edit_tls_policy") }}</div>
                    <t-select v-model="draft.tlsPolicy">
                      <t-option value="strict" :label="t('tls_policy_strict')" />
                      <t-option value="trust_fingerprint" :label="t('tls_policy_trust_fingerprint')" />
                      <t-option value="insecure" :label="t('tls_policy_insecure')" />
                    </t-select>
                  </div>
                  <div v-if="draft.tlsPolicy === 'trust_fingerprint'" class="cp-rackRow__field wide">
                    <div class="cp-rackRow__label">{{ t("rack_edit_tls_fingerprint") }}</div>
                    <t-input v-model="draft.tlsFingerprint" :placeholder="t('fp_placeholder')" clearable />
                  </div>
                  <div class="cp-rackRow__field">
                    <div class="cp-rackRow__label">{{ t("rack_edit_notify_mode") }}</div>
                    <t-select v-model="draft.notifyMode">
                      <t-option value="notify" :label="t('settings_recv_notify')" />
                      <t-option value="silent" :label="t('settings_recv_silent')" />
                      <t-option value="none" :label="t('settings_no_recv')" />
                    </t-select>
                  </div>
                  <div class="cp-rackRow__field wide">
                    <div class="cp-rackRow__label">{{ t("rack_edit_note") }}</div>
                    <t-input v-model="draft.note" :placeholder="t('rack_note_placeholder')" />
                  </div>
                </div>

                <div class="cp-rackRow__editActions">
                  <button class="cp-rackRow__btn primary" type="button" @click="saveEdit">{{ t("rack_edit_save") }}</button>
                  <button class="cp-rackRow__btn" type="button" @click="cancelEdit">{{ t("rack_edit_cancel") }}</button>
                </div>
              </div>
            </div>

            <!-- 操作 -->
            <div class="cp-rackRow__ops">
              <button class="cp-rackRow__op" type="button" @click="togglePinServerById(rack.id)">{{ t("pin_server") }}</button>
              <button v-if="editingId !== rack.id" class="cp-rackRow__op" type="button" @click="beginEdit(rack)">{{ t("edit") }}</button>
              <button class="cp-rackRow__op" type="button" :disabled="loggingOut" @click="requestLogout(rack)">{{ t("logout") }}</button>
              <button class="cp-rackRow__op danger" type="button" @click="handleRemove(rack.id)">{{ t("remove") }}</button>
            </div>
          </article>
        </div>
      </section>

      <!-- 退出登录确认弹窗：退出登录按服务器维度执行 -->
      <t-dialog
        attach="body"
        v-model:visible="showLogoutConfirm"
        :header="t('logout')"
        :confirm-btn="{
          content: t('logout'),
          loading: loggingOut,
          theme: 'danger',
        }"
        :cancel-btn="t('cancel')"
        @confirm="handleLogout"
      >
        <p>{{ t("servers_logout_confirm") }}</p>
        <div class="cp-servers__logoutHint">{{ t("servers_logout_hint") }}</div>
        <div v-if="logoutTarget" class="cp-servers__logoutTarget">{{ logoutTarget.name }} · {{ logoutTarget.serverSocket }}</div>
        <div v-if="logoutError" class="cp-servers__error">{{ logoutError }}</div>
      </t-dialog>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* 样式：服务器管理页｜布局：工作台骨架 + PageHeader + 表单卡/透明列表区｜约束：桌面列表内滚动、窄屏整页滚动 */

/* 页面骨架：8px 留白 + 单张玻璃面 */
.cp-servers {
  @include cp-workspace;

  overflow: hidden;
}

/* PageHeader 右侧 active socket 区 */
.cp-servers__active {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.cp-servers__activeK {
  @include cp-section-label;
}

/* 新增/维护模块：共享玻璃面上的内容卡 */
.cp-servers__create,
.cp-servers__maintenance {
  @include cp-card;

  padding: 12px;
}

/* 列表区域：共享玻璃面上的透明区域，头部固定、行列表内部滚动 */
.cp-servers__listWrap {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

/* 面板标题：display 字体小标题 */
.cp-servers__createTitle {
  font-family: var(--cp-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--cp-text);
}

/* 新增栅格：名称 / socket / 主操作 */
.cp-servers__createGrid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) auto;
  align-items: end;
  gap: 12px;
}

.cp-servers__maintenanceGrid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items: start;
  gap: 12px;
}

.cp-servers__field {
  min-width: 0;
}

.cp-servers__field.wide {
  grid-column: span 2;
}

.cp-servers__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-servers__maintenanceHint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-servers__maintenanceActions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
}

.cp-servers__error {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-danger);
}

/* 退出登录确认弹窗补充说明 */
.cp-servers__logoutHint {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-servers__logoutTarget {
  margin-top: 8px;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

.cp-servers__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

/* 动作按钮：统一胶囊（primary=highlight / danger=状态 token） */
.cp-servers__btn {
  @include cp-pill-button;
}

.cp-servers__btn.primary {
  @include cp-pill-button(primary);
}

.cp-servers__btn.danger {
  @include cp-pill-button(danger);
}

/* 列表面板头部：微标签 + 计数（工作台内不画分隔线） */
.cp-servers__listHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 2px 0;
}

.cp-servers__listTitle {
  @include cp-section-label;
}

.cp-servers__listMeta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.cp-servers__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-servers__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  font-variant-numeric: tabular-nums;
}

/* 分组容器：一张内容卡承载所有 rack 行，行间不画分隔线 */
.cp-servers__list {
  @include cp-card;

  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* rack 行：紧凑行（无独立圆角/阴影），hover 只变底色 */
.cp-rackRow {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  padding: 8px 10px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-rackRow:hover {
  background: var(--cp-hover-bg);
}

/* 当前激活 rack：highlight 底 + 左侧细条 */
.cp-rackRow[data-active="true"] {
  background: var(--cp-highlight-bg);
  box-shadow: inset 2px 0 0 var(--cp-highlight);
}

/* 选择当前 rack：胶囊操作（LED + 文案） */
.cp-rackRow__select {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 30px;
  padding: 0 12px;
  border: 1px solid var(--cp-border);
  border-radius: 999px;
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 11.5px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-rackRow__select:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-rackRow__led {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px var(--cp-accent-soft);
}

.cp-rackRow__selectText {
  font-family: var(--cp-font-display);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* 行主体 */
.cp-rackRow__body {
  min-width: 0;
}

.cp-rackRow__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.cp-rackRow__name {
  font-family: var(--cp-font-display);
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  color: var(--cp-text);
}

.cp-rackRow__tags {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

/* 置顶标记：warn 状态 token */
.cp-rackRow__pill {
  @include cp-section-label;

  padding: 3px 9px;
  border: 1px solid var(--cp-warn-border);
  border-radius: 999px;
  background: var(--cp-warn-bg);
  color: var(--cp-warn);
}

.cp-rackRow__meta {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
}

.cp-rackRow__kv {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
}

.cp-rackRow__kv.wide {
  flex: 1 1 100%;
  min-width: 0;
}

.cp-rackRow__k {
  @include cp-section-label;

  font-size: 10.5px;
}

.cp-rackRow__v {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text);
  overflow-wrap: anywhere;
}

/* 行内编辑态 */
.cp-rackRow__edit {
  margin-top: 12px;
}

.cp-rackRow__editGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.cp-rackRow__field {
  min-width: 0;
}

.cp-rackRow__field.wide {
  grid-column: 1 / -1;
}

.cp-rackRow__label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-rackRow__editActions {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.cp-rackRow__btn {
  @include cp-pill-button;
}

.cp-rackRow__btn.primary {
  @include cp-pill-button(primary);
}

/* 操作区：横向排列的胶囊/图标按钮 */
.cp-rackRow__ops {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.cp-rackRow__op {
  @include cp-pill-button;

  min-height: 28px;
  padding: 0 10px;
  font-size: 11.5px;
}

.cp-rackRow__op.danger {
  @include cp-pill-button(danger);

  min-height: 28px;
  padding: 0 10px;
  font-size: 11.5px;
}

/* 响应式：窄窗口新增栅格与 rack 行改纵向 */
@media (max-width: 1100px) {
  .cp-servers__createGrid {
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
  }
}

@media (max-width: 900px) {
  .cp-servers {
    overflow: auto;
  }

  .cp-servers__listWrap {
    flex: 0 0 auto;
    min-height: 320px;
  }

  .cp-servers__field.wide {
    grid-column: auto;
  }

  .cp-rackRow {
    grid-template-columns: minmax(0, 1fr);
  }

  .cp-rackRow__ops {
    justify-content: flex-start;
  }
}

/* 响应式：≤640px 只压缩内容内边距，页面留白保持 8px */
@media (max-width: 640px) {
  .cp-servers__create,
  .cp-servers__maintenance {
    padding: 10px;
  }
}
</style>
