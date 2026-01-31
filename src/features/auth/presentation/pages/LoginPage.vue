<script setup lang="ts">
/**
 * @fileoverview LoginPage.vue 文件职责说明。
 */

import { onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Alert, Button, Input, MessagePlugin } from 'tdesign-vue-next';
import Avatar from "/test_avatar.jpg?url";
import { getConnectServerUsecase } from '@/features/auth/di/connectServer.di';
import { AuthError } from '@/features/auth/domain/errors/AuthError';
import { createLogger } from '@/shared/utils/logger';
import { createEmailService } from '@/features/auth/data/authServiceFactory';
import { createUserService } from '@/features/user/data/userServiceFactory';
import { setCurrentUser } from '@/features/user/presentation/store/userData';
import { writeAuthToken } from '@/shared/utils/localState';
import { currentServerSocket } from '@/features/servers/presentation/store/currentServer';
import { MOCK_SERVER_SOCKET, USE_MOCK_API } from '@/shared/config/runtime';

const logger = createLogger("LoginPage");

const email = ref('');
const server_socket = ref('');
const transport = ref<"tls" | "tls-insecure" | "tcp">("tls");
const code = ref('');
const loading = ref(false);
const sendCodeCountdown = ref(0);
const emailAlertVisible = ref(false);

const router = useRouter();

/**
 * login 方法说明。
 * @returns 返回值说明。
 */
async function login() {
    loading.value = true;
    try {
        await ensureConnected();
        if (!isValidEmailAddress(email.value)) {
            showInvalidEmailAlert();
            loading.value = false;
            return;
        }
        if (!code.value.trim()) {
            MessagePlugin.error('验证码不能为空');
            loading.value = false;
            return;
        }
        const socket = normalizeSocketWithTransport(server_socket.value.trim(), transport.value);
        const userService = createUserService(socket);
        const token = await userService.loginByEmail(email.value.trim(), code.value.trim());
        const { token: boundToken, uid } = await userService.loginByToken(token);
        const profile = (await userService
            .getUserProfile(uid)
            .catch(() => null)) as null | { username?: unknown; brief?: unknown };
        if (boundToken) writeAuthToken(socket, boundToken);
        else writeAuthToken(socket, token);
        setCurrentUser({
            id: uid,
            email: email.value.trim(),
            username: String(profile?.username ?? email.value.trim().split('@')[0] ?? ''),
            description: String(profile?.brief ?? ''),
        });
        router.push('/chat');
    } catch (e) {
        logger.error("Handshake failed", { error: String(e) });
        if (e instanceof AuthError) MessagePlugin.error(e.message);
        else MessagePlugin.error('握手失败');
    }
    loading.value = false;
}

let sendCodeTimer: ReturnType<typeof setInterval> | null = null;
let emailAlertTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * isValidEmailAddress 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * showInvalidEmailAlert 方法说明。
 * @returns 返回值说明。
 */
function showInvalidEmailAlert() {
  emailAlertVisible.value = true;
  if (emailAlertTimer) clearTimeout(emailAlertTimer);
  emailAlertTimer = setTimeout(() => {
    emailAlertVisible.value = false;
    emailAlertTimer = null;
  }, 3000);
}

/**
 * hideEmailAlert 方法说明。
 * @returns 返回值说明。
 */
function hideEmailAlert() {
  emailAlertVisible.value = false;
  if (emailAlertTimer) clearTimeout(emailAlertTimer);
  emailAlertTimer = null;
}

/**
 * startSendCodeCountdown 方法说明。
 * @param seconds - 参数说明。
 * @returns 返回值说明。
 */
function startSendCodeCountdown(seconds = 60) {
  if (sendCodeTimer) clearInterval(sendCodeTimer);
  sendCodeCountdown.value = seconds;
  sendCodeTimer = setInterval(() => {
    sendCodeCountdown.value -= 1;
    if (sendCodeCountdown.value <= 0) {
      sendCodeCountdown.value = 0;
      if (sendCodeTimer) clearInterval(sendCodeTimer);
      sendCodeTimer = null;
    }
  }, 1000);
}

/**
 * sendCode 方法说明。
 * @returns 返回值说明。
 */
async function sendCode() {
  if (sendCodeCountdown.value > 0) return;
  if (!isValidEmailAddress(email.value)) {
    showInvalidEmailAlert();
    return;
  }
  try {
    await ensureConnected();
    const socket = normalizeSocketWithTransport(server_socket.value.trim(), transport.value);
    await createEmailService(socket).sendCode(email.value.trim());
    startSendCodeCountdown(60);
  } catch (e) {
    logger.error("Send code failed", { error: String(e) });
    MessagePlugin.error('发送验证码失败');
  }
}

watch(email, (nextEmail) => {
  if (emailAlertVisible.value && isValidEmailAddress(nextEmail)) hideEmailAlert();
});

onBeforeUnmount(() => {
  if (sendCodeTimer) clearInterval(sendCodeTimer);
  sendCodeTimer = null;
  if (emailAlertTimer) clearTimeout(emailAlertTimer);
  emailAlertTimer = null;
});

/**
 * ensureConnected 方法说明。
 * @returns 返回值说明。
 */
async function ensureConnected() {
  if (USE_MOCK_API) {
    if (!server_socket.value.trim()) {
      server_socket.value = MOCK_SERVER_SOCKET;
    }
  }

  const socket = normalizeSocketWithTransport(server_socket.value.trim(), transport.value);
  if (!socket) throw new AuthError("Missing server socket");
  if (currentServerSocket.value !== socket) {
    const connectServer = getConnectServerUsecase();
    await connectServer.execute({
      serverSocket: socket,
    });
  }
}

/**
 * normalizeSocketWithTransport 方法说明。
 * @param raw - 参数说明。
 * @param mode - 参数说明。
 * @returns 返回值说明。
 */
function normalizeSocketWithTransport(raw: string, mode: "tls" | "tls-insecure" | "tcp"): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (mode === "tcp") return `tcp://${trimmed}`;
  if (mode === "tls-insecure") return `tls-insecure://${trimmed}`;
  return `tls://${trimmed}`;
}
</script>

<template>
  <!-- 页面：登录｜职责：与服务端握手建立连接，成功后进入聊天页 -->
  <!-- 区块：<div> .login-page -->
  <div class="login-page">
    <!-- 区块：<div> .login-shell -->
    <div class="login-shell">
      <!-- 区块：<section> .brand-panel -->
      <section class="brand-panel">
        <header class="rack-head">
          <div class="rack-kicker">RACK OVERVIEW</div>
          <div class="rack-brand">CarryPigeon Desktop</div>
        </header>

        <div class="rack-block">
          <div class="rack-label">{{ $t('server_socket') }}</div>
          <Input
            id="server-input"
            class="login-input rack-input"
            v-model="server_socket"
            type="text"
            autocomplete="off"
            :placeholder="$t('server_socket')"
          />

          <div class="rack-row">
            <div class="rack-label">{{ $t('transport') }}</div>
            <select v-model="transport" class="cp-field rack-select" aria-label="transport">
              <option value="tls">{{ $t('transport_tls_strict') }}</option>
              <option value="tls-insecure">{{ $t('transport_tls_insecure') }}</option>
              <option value="tcp">{{ $t('transport_tcp_legacy') }}</option>
            </select>
          </div>

          <div class="rack-status">
            <div class="status-row">
              <div class="status-k">Status</div>
              <div class="status-v">
                <span class="status-led" :data-ready="Boolean(server_socket.trim())" aria-hidden="true"></span>
                <span class="status-text">
                  {{ server_socket.trim() ? "Handshake Ready" : "Waiting for socket" }}
                </span>
              </div>
            </div>
            <div class="status-hint">
              若服务端返回 required 门禁，将自动进入 <span class="mono">/required-setup</span>。
            </div>
          </div>
        </div>
      </section>

      <!-- 区块：<section> .login-container -->
      <section class="login-container">
        <div class="login-head">
          <img class="user-image" :src="Avatar" alt="avatar" />
          <div class="login-titles">
            <h1 class="login-title">{{ $t('login') }}</h1>
            <p class="login-subtitle">Handshake → Code → Chat</p>
          </div>
        </div>

        <form class="login-form" @submit.prevent="login">
          <Alert
            v-if="emailAlertVisible"
            class="email-alert"
            theme="warning"
            :message="$t('email_invalid')"
            :closeBtn="true"
            :onClose="hideEmailAlert"
          />

          <div class="field">
            <div class="field-label">{{ $t('email') }}</div>
            <Input
              id="email-input"
              class="login-input"
              v-model="email"
              type="text"
              autocomplete="email"
              :placeholder="$t('email')"
            />
          </div>

          <div class="field">
            <div class="field-label">{{ $t('login_code') }}</div>
            <Input
              id="code-input"
              class="login-input"
              v-model="code"
              type="text"
              autocomplete="one-time-code"
              :placeholder="$t('login_code')"
            >
              <template #suffix>
                <Button
                  class="send-code-button"
                  size="small"
                  variant="text"
                  theme="primary"
                  :disabled="sendCodeCountdown > 0"
                  @click.stop="sendCode"
                >
                  {{ sendCodeCountdown > 0 ? `${$t('send_code')} (${sendCodeCountdown}s)` : $t('send_code') }}
                </Button>
              </template>
            </Input>
          </div>

          <button class="login-button" :disabled="loading" type="submit">
            <span v-if="loading">{{ $t('loading') }}</span>
            <span v-else>{{ $t('login') }}</span>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：登录页布局（暖纸 + 玻璃卡片） */
.login-page {
  --login-pad: clamp(14px, 2.6vw, 28px);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  width: 100vw;
  background: transparent;
  padding: var(--login-pad);
  box-sizing: border-box;
  overflow: hidden;
}

/* 样式：.login-shell */
.login-shell {
  width: min(1120px, calc(100vw - (var(--login-pad) * 2)));
  height: min(720px, calc(100vh - (var(--login-pad) * 2)));
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  border-radius: clamp(22px, 2.3vw, 28px);
  overflow: hidden;
  border: 1px solid var(--cp-border);
  box-shadow: var(--cp-shadow);
  background: var(--cp-surface);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  animation: cp-fade-up 520ms var(--cp-ease, ease) both;
  position: relative;
}

.login-shell::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(780px 420px at 12% 8%, var(--cp-glow-a), transparent 60%),
    radial-gradient(700px 420px at 92% 92%, var(--cp-glow-b), transparent 55%);
  mix-blend-mode: overlay;
  opacity: 0.55;
}

/* 左侧品牌面板 */
.brand-panel {
  position: relative;
  padding: clamp(18px, 2.2vw, 26px);
  color: rgba(255, 253, 248, 0.94);
  background:
    radial-gradient(900px 520px at 20% 20%, rgba(15, 118, 110, 0.85), transparent 62%),
    radial-gradient(800px 520px at 80% 80%, rgba(194, 65, 12, 0.62), transparent 58%),
    linear-gradient(180deg, rgba(20, 32, 29, 0.92), rgba(20, 32, 29, 0.72));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.rack-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 253, 248, 0.14);
}

.rack-kicker {
  font-family: var(--cp-font-display);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.72);
}

.rack-brand {
  font-family: var(--cp-font-display);
  font-size: 14px;
  letter-spacing: -0.01em;
  color: rgba(255, 253, 248, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rack-block {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid rgba(255, 253, 248, 0.14);
  background: rgba(17, 24, 39, 0.22);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.22);
}

.rack-label {
  font-size: 12px;
  color: rgba(226, 232, 240, 0.72);
  letter-spacing: 0.02em;
}

.rack-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rack-select {
  width: 100%;
}

.rack-status {
  margin-top: 2px;
  border: 1px dashed rgba(255, 253, 248, 0.18);
  background: rgba(17, 24, 39, 0.18);
  border-radius: 16px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.status-k {
  font-family: var(--cp-font-display);
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.62);
}

.status-v {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.status-led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.8);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.14);
}

.status-led[data-ready="true"] {
  background: var(--cp-accent);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.18);
}

.status-text {
  font-size: 12px;
  color: rgba(255, 253, 248, 0.86);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-hint {
  font-size: 12px;
  line-height: 1.45;
  color: rgba(226, 232, 240, 0.62);
}

.mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: rgba(226, 232, 240, 0.78);
}

.brand-panel::before {
  content: "";
  position: absolute;
  inset: -2px;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255, 253, 248, 0.16) 0 2px, transparent 3px),
    radial-gradient(circle at 70% 60%, rgba(255, 253, 248, 0.12) 0 2px, transparent 3px),
    radial-gradient(circle at 40% 80%, rgba(255, 253, 248, 0.1) 0 2px, transparent 3px);
  opacity: 0.7;
  filter: blur(0.2px);
  pointer-events: none;
}

.brand-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent, rgba(255, 253, 248, 0.10), transparent),
    linear-gradient(180deg, rgba(0, 0, 0, 0.18), transparent 28%, transparent 72%, rgba(0, 0, 0, 0.22));
  opacity: 0.28;
  mix-blend-mode: overlay;
}

/* 右侧登录卡片 */
.login-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--cp-panel);
  padding: clamp(18px, 2.2vw, 30px);
  width: 100%;
  position: relative;
  isolation: isolate;
  overflow: hidden;
  min-height: 0;
  min-width: 0;
}

.login-container::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(620px 320px at 20% 10%, var(--cp-glow-a), transparent 60%),
    radial-gradient(680px 360px at 90% 84%, var(--cp-glow-b), transparent 58%);
  opacity: 0.9;
}

.login-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  position: relative;
}

/* 样式：.user-image */
.user-image {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid var(--cp-border-light);
  box-shadow: 0 14px 30px rgba(20, 32, 29, 0.12);
}

.login-titles {
  min-width: 0;
}

.login-title {
  margin: 0;
  color: var(--cp-text);
  font-size: clamp(18px, 1.8vw, 22px);
  font-weight: 700;
  letter-spacing: -0.02em;
}

.login-subtitle {
  margin: 2px 0 0;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  position: relative;
}

/* 样式：.email-alert */
.email-alert {
  width: 100%;
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 12px;
  color: var(--cp-text-muted);
  letter-spacing: 0.02em;
}

.login-input {
  width: 100%;
}

.login-select {
  appearance: none;
}

/* 样式：.send-code-button */
.send-code-button {
  padding: 0 10px;
  height: 28px;
}

.login-input :deep(.t-input__suffix) {
  padding-left: 6px;
}

.send-code-button {
  border-radius: 999px;
}

.send-code-button :deep(.t-button__text) {
  font-weight: 650;
  letter-spacing: 0.01em;
}

.send-code-button:hover {
  background: var(--cp-accent-soft) !important;
}

/* 样式：.login-button */
.login-button {
  width: 100%;
  padding: 12px;
  background: linear-gradient(180deg, var(--cp-accent), var(--cp-accent-hover));
  color: #ffffff;
  border: none;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    transform var(--cp-fast, 160ms) var(--cp-ease, ease),
    filter var(--cp-fast, 160ms) var(--cp-ease, ease),
    opacity var(--cp-fast, 160ms) var(--cp-ease, ease);
  margin-top: 6px;
  box-shadow: 0 18px 40px var(--cp-accent-shadow);

  /* 样式：&:hover */
  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.02);
  }

  /* 样式：&:active */
  &:active {
    transform: translateY(0px);
    filter: brightness(0.98);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
}

@media (max-width: 860px) {
  .login-shell {
    grid-template-columns: 1fr;
    height: min(720px, calc(100vh - (var(--login-pad) * 2)));
  }
  .brand-panel {
    display: none;
  }
}

@media (max-height: 520px) {
  .brand-panel {
    display: none;
  }
  .login-shell {
    height: calc(100vh - (var(--login-pad) * 2));
  }
}

@media (max-height: 600px) {
  .login-page {
    --login-pad: 14px;
  }

  .login-shell {
    height: min(720px, calc(100vh - (var(--login-pad) * 2)));
  }

  .login-container {
    padding: 16px 16px;
    justify-content: flex-start;
  }

  .brand-panel {
    padding: 18px 18px;
  }

  .brand-copy {
    margin-top: 18px;
  }

  .brand-chips {
    display: none;
  }

  .login-form {
    gap: 10px;
  }

  .login-head {
    margin-bottom: 10px;
  }

  .login-button {
    margin-top: 4px;
  }
}

@media (max-height: 560px) {
  .login-page {
    --cp-field-height: 34px;
  }

  .brand-title {
    font-size: 28px;
  }

  .brand-desc {
    display: none;
  }
}
</style>
