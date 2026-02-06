<script setup lang="ts">
/**
 * @fileoverview LoginPage.vue
 * @description auth｜页面：LoginPage。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { getLoginWithEmailCodeUsecase, getSendVerificationCodeUsecase } from "@/features/auth/di/auth.di";
import { isAuthRequiredPluginMissingError, setMissingRequiredPlugins } from "@/features/auth/api";
import { addServer, currentServerSocket, serverRacks, setServerSocket, useServerInfoStore } from "@/features/servers/api";
import { connectWithRetry, connectionDetail, connectionPillState, connectionPhase, retryLast } from "@/features/network/api";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { writeAuthSession } from "@/shared/utils/localState";
import { setCurrentUser } from "@/features/user/api";
import { createLogger } from "@/shared/utils/logger";

type TransportKind = "tls_strict" | "tls_insecure" | "tcp_legacy";

const router = useRouter();
const logger = createLogger("LoginPage");

const transport = ref<TransportKind>("tls_strict");
const socketDraft = ref(currentServerSocket.value);

const email = ref("");
const code = ref("");
const sending = ref(false);
const loggingIn = ref(false);
const banner = ref<string>("");

const countdown = ref(0);
let countdownTimer: number | null = null;

/**
 * 计算当前登录阶段（用于 UI 展示）。
 *
 * @returns `"Handshake"` 或 `"Auth"`。
 */
function computeStage(): "Handshake" | "Auth" {
  if (connectionPhase.value === "connected") return "Auth";
  if (connectionPhase.value === "connecting") return "Handshake";
  if (connectionPhase.value === "failed") return "Handshake";
  return "Handshake";
}

const stage = computed(computeStage);

/**
 * 获取当前 socket 对应的 server-info store。
 *
 * @returns server-info store 实例。
 */
function computeServerInfoStore() {
  return useServerInfoStore(currentServerSocket.value.trim());
}

const serverInfoStore = computed(computeServerInfoStore);

/**
 * 便捷计算：当前服务端信息。
 *
 * @returns 服务端信息（或 `null`）。
 */
function computeServerInfo() {
  return serverInfoStore.value.info.value;
}

const serverInfo = computed(computeServerInfo);

/**
 * 将输入框草稿 socket 同步到全局 `currentServerSocket`。
 *
 * 说明：
 * UI 编辑态（draft）与“已选中/已连接”的 socket 分离，避免边输入边触发连接副作用。
 *
 * @returns void
 */
function syncServerSocket(): void {
  const next = socketDraft.value.trim();
  setServerSocket(next);
}

/**
 * 启动 1 秒倒计时（用于“重新发送验证码”按钮）。
 *
 * @param seconds - 初始倒计时秒数。
 * @returns void
 */
function startCountdown(seconds: number): void {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdown.value = Math.max(0, Math.trunc(seconds));
  countdownTimer = window.setInterval(handleCountdownTick, 1000);
}

/**
 * 倒计时 tick：每秒递减，到 0 自动停止。
 *
 * @returns void
 */
function handleCountdownTick(): void {
  countdown.value = Math.max(0, countdown.value - 1);
  if (countdown.value <= 0 && countdownTimer) {
    window.clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

/**
 * 发送邮箱验证码（根据运行时决定 mock/real）。
 *
 * 校验策略：
 * 这里仅做轻量校验，因为该页面同时承担 UI 预览/调试入口的职责。
 *
 * @returns `Promise<void>`
 */
async function handleSendCode(): Promise<void> {
  banner.value = "";
  const socket = currentServerSocket.value.trim();
  if (!socket) {
    banner.value = "Missing server socket.";
    return;
  }
  if (!email.value.trim()) {
    banner.value = "Missing email.";
    return;
  }

  sending.value = true;
  try {
    await getSendVerificationCodeUsecase(socket).execute(email.value.trim());
    startCountdown(60);
    banner.value = "Code sent.";
  } catch (e) {
    banner.value = String(e) || "Send failed.";
  } finally {
    sending.value = false;
  }
}

/**
 * 使用邮箱 + 验证码登录。
 *
 * 行为：
 * - 成功：保存 token，并填充 `currentUser`（当前为 mock identity）；
 * - 若服务端要求必装插件：跳转到 `/required-setup`。
 *
 * @returns `Promise<void>`
 */
async function handleLogin(): Promise<void> {
  banner.value = "";
  const socket = currentServerSocket.value.trim();
  if (!socket) {
    banner.value = "Missing server socket.";
    return;
  }
  if (!email.value.trim() || !code.value.trim()) {
    banner.value = "Missing email or code.";
    return;
  }

  loggingIn.value = true;
  try {
    const res = await getLoginWithEmailCodeUsecase(socket).execute(email.value.trim(), code.value.trim());
    writeAuthSession(socket, {
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      uid: res.uid,
      expiresAtMs: Date.now() + Math.max(0, Math.trunc(res.expiresInSec)) * 1000,
    });
    setCurrentUser({
      id: res.uid || "1",
      username: email.value.trim().split("@")[0] || "Operator",
      email: email.value.trim(),
      description: "Patchbay operator (mock).",
    });
    void router.replace({ path: "/chat", query: res.isNewUser ? { welcome: "new" } : undefined });
  } catch (e) {
    if (isAuthRequiredPluginMissingError(e)) {
      setMissingRequiredPlugins(e.payload.missing_plugins);
      void router.replace("/required-setup");
      return;
    }
    banner.value = String(e) || "Login failed.";
  } finally {
    loggingIn.value = false;
  }
}

/**
 * 对当前 socket draft 执行握手/连接流程。
 *
 * 成功后额外刷新 server info，以获取稳定的 `server_id`：
 * 插件系统需要 `server_id` 做“按服务端隔离”的本地存储命名空间。
 *
 * @returns `Promise<void>`
 */
async function handleConnect(): Promise<void> {
  syncServerSocket();
  const socket = currentServerSocket.value.trim();
  await connectWithRetry(socket, { maxAttempts: 6 });
  if (connectionPhase.value === "connected") {
    await serverInfoStore.value.refresh();
    logger.info("Action: server_info_refreshed", { socket, serverId: serverInfo.value?.serverId ?? "" });
  }
}

watch(
  watchCurrentServerSocket,
  handleCurrentServerSocketChange,
);

watch(
  watchSocketDraft,
  handleSocketDraftChange,
);

/**
 * watch 源：当前 server socket。
 *
 * @returns 当前 server socket 字符串。
 */
function watchCurrentServerSocket(): string {
  return currentServerSocket.value;
}

/**
 * 将可编辑的 socket draft 与“已选中 socket”保持同步。
 *
 * @param next - 新的 server socket。
 * @returns void
 */
function handleCurrentServerSocketChange(next: string): void {
  socketDraft.value = next;
}

/**
 * watch 源：socket draft。
 *
 * @returns 当前 socket draft。
 */
function watchSocketDraft(): string {
  return socketDraft.value;
}

/**
 * 用户编辑 socket 时清理临时 banner（错误提示等）。
 *
 * @returns void
 */
function handleSocketDraftChange(): void {
  banner.value = "";
}

/**
 * 组件挂载：确保存在默认 rack，并尝试首次连接。
 *
 * @returns void
 */
function handleMounted(): void {
  if (serverRacks.value.length === 0 && currentServerSocket.value.trim()) {
    addServer(currentServerSocket.value, "Default");
  }
  void handleConnect();

  window.addEventListener("keydown", onGlobalKeydown);
}

onMounted(handleMounted);

/**
 * 组件卸载：移除全局键盘监听。
 */
function handleBeforeUnmount(): void {
  if (countdownTimer) window.clearInterval(countdownTimer);
  countdownTimer = null;
  window.removeEventListener("keydown", onGlobalKeydown);
}

onBeforeUnmount(handleBeforeUnmount);

/**
 * 登录页全局快捷键。
 *
 * - Ctrl/Cmd+P：打开插件中心
 * - Ctrl/Cmd+,：打开设置页
 *
 * @param e - 键盘事件。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  const k = e.key.toLowerCase();
  const meta = e.metaKey || e.ctrlKey;
  if (!meta) return;

  if (k === "p") {
    e.preventDefault();
    void router.push("/plugins");
    return;
  }

  if (k === ",") {
    e.preventDefault();
    void router.push("/settings");
  }
}
</script>

<template>
  <!-- 页面：LoginPage｜职责：连接阶段（Handshake）+ 验证码登录（Auth） -->
  <!-- 区块：<main> .cp-login -->
  <main class="cp-login">
    <section class="cp-login__left">
      <header class="cp-login__leftHead">
        <div class="cp-login__brand">
          <div class="cp-login__brandMark" aria-hidden="true"></div>
          <div class="cp-login__brandText">
            <div class="cp-login__brandName">CarryPigeon</div>
            <div class="cp-login__brandSub">Modular Patchbay</div>
          </div>
        </div>
        <div class="cp-login__stageWrap">
          <div class="cp-login__stage">
            <span class="cp-login__stageItem" :data-active="stage === 'Handshake'">Handshake</span>
            <span class="cp-login__stageSep">→</span>
            <span class="cp-login__stageItem" :data-active="stage === 'Auth'">Auth</span>
          </div>
          <div class="cp-login__kbdHint">Ctrl/Cmd+P: Plugins · Ctrl/Cmd+,: Settings</div>
        </div>
      </header>

      <div class="cp-login__rack">
        <div class="cp-login__label">Rack Overview</div>

        <div class="cp-login__field">
          <div class="cp-login__fieldLabel">server_socket</div>
          <t-input v-model="socketDraft" placeholder="tls://host:port or mock://handshake" clearable />
          <div class="cp-login__fieldHint">
            <MonoTag :value="currentServerSocket || '—'" title="current socket" :copyable="true" />
            <button class="cp-login__miniBtn" type="button" @click="handleConnect">Connect</button>
          </div>
        </div>

        <div class="cp-login__field">
          <div class="cp-login__fieldLabel">transport</div>
          <div class="cp-login__seg">
            <button class="cp-login__segBtn" :data-active="transport === 'tls_strict'" type="button" @click="transport = 'tls_strict'">
              TLS Strict
            </button>
            <button class="cp-login__segBtn" :data-active="transport === 'tls_insecure'" type="button" @click="transport = 'tls_insecure'">
              TLS Insecure
            </button>
            <button class="cp-login__segBtn" :data-active="transport === 'tcp_legacy'" type="button" @click="transport = 'tcp_legacy'">
              TCP Legacy
            </button>
          </div>
          <div class="cp-login__transportHint">
            (Mock preview ignores transport; real mode should enforce TLS policies.)
          </div>
        </div>

        <div class="cp-login__field">
          <div class="cp-login__fieldLabel">connection</div>
          <ConnectionPill
            :state="connectionPillState"
            label="Server link"
            :detail="connectionDetail"
            :action-label="connectionPhase === 'failed' ? 'Retry' : ''"
            @action="retryLast"
          />
        </div>

        <div class="cp-login__field">
          <div class="cp-login__fieldLabel">server_id</div>
          <div class="cp-login__fieldHint">
            <MonoTag :value="serverInfo?.serverId || '—'" title="server_id" :copyable="true" />
          </div>
          <div class="cp-login__transportHint">
            server_id is required for plugin isolation. If missing, Plugin Center will be disabled.
          </div>
        </div>
      </div>

      <div class="cp-login__leftFoot">
        <div class="cp-login__monoBlock">
          <div class="cp-login__monoTitle">Tip</div>
          <div class="cp-login__monoText">
            In mock mode, any email + code works — unless required modules are missing. Install them via the Power Latch.
          </div>
        </div>
        <button class="cp-login__ghost" type="button" @click="$router.push('/servers')">Open Server Manager</button>
        <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">Open Plugin Center</button>
      </div>
    </section>

    <section class="cp-login__right">
      <div class="cp-login__panel">
        <div class="cp-login__panelTitle">Auth Panel</div>
        <div class="cp-login__panelSub">Email code session (login / register)</div>

        <div v-if="banner" class="cp-login__banner">{{ banner }}</div>

        <div class="cp-login__form">
          <div class="cp-login__formRow">
            <div class="cp-login__fieldLabel">email</div>
            <t-input v-model="email" placeholder="you@domain.com" clearable />
          </div>

          <div class="cp-login__formRow">
            <div class="cp-login__fieldLabel">code</div>
            <div class="cp-login__codeRow">
              <t-input v-model="code" placeholder="123456" clearable />
              <button
                class="cp-login__sendBtn"
                type="button"
                :disabled="sending || countdown > 0"
                @click="handleSendCode"
              >
                {{ countdown > 0 ? `Resend (${countdown})` : sending ? "Sending…" : "Send Code" }}
              </button>
            </div>
          </div>

          <button class="cp-login__primary" type="button" :disabled="loggingIn" @click="handleLogin">
            {{ loggingIn ? "Signing in…" : "Sign In / Register" }}
          </button>

          <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">Open Plugin Center</button>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped lang="scss">
/* LoginPage styles */
/* Layout: two-panel login (left handshake / right auth) */
.cp-login {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 460px);
  gap: 14px;
  padding: 14px;
}

/* Shell: shared panel container */
.cp-login__left,
.cp-login__right {
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
  backdrop-filter: blur(16px) saturate(1.08);
  -webkit-backdrop-filter: blur(16px) saturate(1.08);
  overflow: hidden;
  min-width: 0;
}

/* Left column layout */
.cp-login__left {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

/* Left header (brand + stage) */
.cp-login__leftHead {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* Brand cluster */
.cp-login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Brand mark */
.cp-login__brandMark {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--cp-highlight-border);
  background:
    radial-gradient(10px 10px at 30% 35%, color-mix(in oklab, var(--cp-highlight) 86%, transparent), transparent 60%),
    radial-gradient(12px 12px at 68% 60%, color-mix(in oklab, var(--cp-accent-2) 84%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-solid) 72%, var(--cp-bg));
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
}

/* Brand name */
.cp-login__brandName {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: var(--cp-text);
}

/* Brand subtitle */
.cp-login__brandSub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Stage indicator (Handshake → Auth) */
.cp-login__stage {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 999px;
  padding: 8px 12px;
}

.cp-login__stageWrap {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.cp-login__kbdHint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Stage item */
.cp-login__stageItem {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Stage active item */
.cp-login__stageItem[data-active="true"] {
  color: var(--cp-text);
}

/* Stage arrow separator */
.cp-login__stageSep {
  opacity: 0.55;
}

/* Rack overview panel */
.cp-login__rack {
  padding: 14px;
  overflow: auto;
}

/* Section label */
.cp-login__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Field wrapper */
.cp-login__field {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Field label */
.cp-login__fieldLabel {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 8px;
}

/* Field hint row */
.cp-login__fieldHint {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Mini connect button */
.cp-login__miniBtn {
  border: 1px solid var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Mini connect hover */
.cp-login__miniBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg-strong);
}

.cp-login__miniBtn:active {
  transform: translateY(0);
}

/* Transport segmented control */
.cp-login__seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Transport segment button */
.cp-login__segBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

/* Segment hover */
.cp-login__segBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.cp-login__segBtn:active {
  transform: translateY(0);
}

/* Segment active */
.cp-login__segBtn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
}

/* Transport hint text */
.cp-login__transportHint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Left footer area */
.cp-login__leftFoot {
  border-top: 1px solid var(--cp-border-light);
  padding: 14px;
}

/* Tip block */
.cp-login__monoBlock {
  border: 1px dashed rgba(148, 163, 184, 0.22);
  background: var(--cp-panel-muted);
  border-radius: 18px;
  padding: 12px;
}

/* Tip title */
.cp-login__monoTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* Tip text */
.cp-login__monoText {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}

/* Right column wrapper */
.cp-login__right {
  display: grid;
  place-items: center;
  padding: 14px;
}

/* Auth panel card */
.cp-login__panel {
  width: min(440px, 100%);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 16px;
}

/* Panel title */
.cp-login__panelTitle {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

/* Panel subtitle */
.cp-login__panelSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Banner for inline feedback */
.cp-login__banner {
  margin-top: 12px;
  border: 1px dashed var(--cp-highlight-border);
  background: var(--cp-highlight-bg);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text);
}

/* Form wrapper */
.cp-login__form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Code row (input + send) */
.cp-login__codeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

/* Send code button */
.cp-login__sendBtn {
  height: var(--cp-field-height);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 0 14px;
  min-width: 128px;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Send hover (enabled only) */
.cp-login__sendBtn:hover:enabled {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-login__sendBtn:active:enabled {
  transform: translateY(0);
}

/* Send disabled */
.cp-login__sendBtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* Primary sign-in button */
.cp-login__primary {
  border: 1px solid var(--cp-highlight-border-strong);
  background:
    radial-gradient(140px 34px at 24% 0%, color-mix(in oklab, var(--cp-highlight) 24%, transparent), transparent 60%),
    radial-gradient(160px 38px at 78% 0%, color-mix(in oklab, var(--cp-accent) 18%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-muted) 92%, transparent);
  color: var(--cp-text);
  border-radius: 999px;
  height: calc(var(--cp-field-height) + 6px);
  padding: 0 14px;
  font-size: 13px;
  cursor: pointer;
  box-shadow: 0 18px 44px color-mix(in oklab, var(--cp-highlight) 16%, transparent);
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Primary hover (enabled only) */
.cp-login__primary:hover:enabled {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--cp-highlight) 66%, var(--cp-border));
  background:
    radial-gradient(140px 34px at 24% 0%, color-mix(in oklab, var(--cp-highlight) 30%, transparent), transparent 60%),
    radial-gradient(160px 38px at 78% 0%, color-mix(in oklab, var(--cp-accent) 22%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-hover-bg) 86%, var(--cp-panel-muted));
}

.cp-login__primary:active:enabled {
  transform: translateY(0);
}

/* Primary disabled */
.cp-login__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Ghost navigation button */
.cp-login__ghost {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text-muted);
  border-radius: 999px;
  padding: 10px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);
}

/* Ghost hover */
.cp-login__ghost:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-login__ghost:active {
  transform: translateY(0);
}

.cp-login__miniBtn:focus-visible,
.cp-login__segBtn:focus-visible,
.cp-login__sendBtn:focus-visible,
.cp-login__primary:focus-visible,
.cp-login__ghost:focus-visible {
  outline: 2px solid color-mix(in oklab, var(--cp-info) 42%, var(--cp-border));
  outline-offset: 2px;
}

@media (max-width: 980px) {
  .cp-login {
    grid-template-columns: 1fr;
  }

  .cp-login__right {
    place-items: stretch;
  }

  .cp-login__panel {
    width: 100%;
    max-width: 560px;
    margin: 0 auto;
  }
}

@media (max-width: 560px) {
  .cp-login {
    gap: 12px;
    padding: 12px;
  }

  .cp-login__leftHead {
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-login__miniBtn,
  .cp-login__segBtn,
  .cp-login__sendBtn,
  .cp-login__primary,
  .cp-login__ghost {
    transition: none !important;
  }
}
</style>
