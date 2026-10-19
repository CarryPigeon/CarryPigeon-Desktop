<script setup lang="ts">
/**
 * @fileoverview RegisterPage.vue
 * @description account/auth-flow｜页面：RegisterPage。
 */

import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  authConnectionDetail as connectionDetail,
  authConnectionPhase as connectionPhase,
  authConnectionPillState as connectionPillState,
  authServerSocket as currentServerSocket,
  retryAuthServerWorkspace as retryLast,
} from "@/features/account/auth-flow/integration/serverWorkspace";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import MonoTag from "@/shared/ui/MonoTag.vue";
import { useLoginConnection } from "@/features/account/auth-flow/presentation/composables/useLoginConnection";
import { useLoginEmailAuth } from "@/features/account/auth-flow/presentation/composables/useLoginEmailAuth";
import { useLoginPasswordAuth } from "@/features/account/auth-flow/presentation/composables/useLoginPasswordAuth";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";

const router = useRouter();
const { t } = useI18n();

const authMethod = ref<"email" | "password">("password");

const {
  email,
  code,
  sending,
  loggingIn: emailLoggingIn,
  banner: emailBanner,
  countdown,
  clearBanner: clearEmailBanner,
  handleSendCode,
  handleLogin,
} = useLoginEmailAuth({
  router,
  mode: "register",
});

const {
  username,
  password,
  loggingIn: passwordLoggingIn,
  banner: passwordBanner,
  clearBanner: clearPasswordBanner,
  handlePasswordAuth,
} = useLoginPasswordAuth({
  router,
  mode: "register",
});

const { socketDraft, stage, serverInfo, handleConnect } = useLoginConnection({
  onSocketDraftChanged: () => {
    clearEmailBanner();
    clearPasswordBanner();
  },
});

function switchAuthMethod(method: "email" | "password"): void {
  authMethod.value = method;
  clearEmailBanner();
  clearPasswordBanner();
}
</script>

<template>
  <!-- 页面：RegisterPage｜职责：连接阶段（Handshake）+ 注册认证（Auth） -->
  <!-- 区块：<main> .cp-login -->
  <main class="cp-login">
    <ErrorBoundary>
      <section class="cp-login__left">
        <header class="cp-login__leftHead">
          <div class="cp-login__brand">
            <div class="cp-login__brandMark" aria-hidden="true"></div>
            <div class="cp-login__brandText">
              <div class="cp-login__brandName">CarryPigeon</div>
              <div class="cp-login__brandSub">{{ t("app_tagline") }}</div>
            </div>
          </div>
          <div class="cp-login__stageWrap">
            <div class="cp-login__stage">
              <span class="cp-login__stageItem" :data-active="stage === 'Handshake'">{{ t("stage_handshake") }}</span>
              <span class="cp-login__stageSep">→</span>
              <span class="cp-login__stageItem" :data-active="stage === 'Auth'">{{ t("stage_auth") }}</span>
            </div>
            <div class="cp-login__kbdHint">{{ t("hotkey_hint") }}</div>
          </div>
        </header>

        <div class="cp-login__rack">
          <div class="cp-login__label">{{ t("rack_overview") }}</div>

          <div class="cp-login__field">
            <div class="cp-login__fieldLabel">{{ t("server_socket") }}</div>
            <t-input v-model="socketDraft" :placeholder="t('server_socket_placeholder')" clearable />
            <div class="cp-login__fieldHint">
              <MonoTag :value="currentServerSocket || '—'" :title="t('current_server_socket')" :copyable="true" />
              <button class="cp-login__miniBtn" type="button" @click="handleConnect">{{ t("login_connect") }}</button>
            </div>
          </div>

          <div class="cp-login__field">
            <div class="cp-login__fieldLabel">{{ t("login_field_connection") }}</div>
            <ConnectionPill
              :state="connectionPillState"
              :label="t('conn_server_link')"
              :detail="connectionDetail"
              :action-label="connectionPhase === 'failed' ? t('conn_retry') : ''"
              @action="retryLast"
            />
          </div>

          <div class="cp-login__field">
            <div class="cp-login__fieldLabel">{{ t("server_id_label") }}</div>
            <div class="cp-login__fieldHint">
              <MonoTag :value="serverInfo?.serverId || '—'" :title="t('server_id_label')" :copyable="true" />
            </div>
            <div class="cp-login__transportHint">
              {{ t("login_server_id_hint") }}
            </div>
          </div>
        </div>

        <div class="cp-login__leftFoot">
          <div class="cp-login__monoBlock">
            <div class="cp-login__monoTitle">{{ t("tip_title") }}</div>
            <div class="cp-login__monoText">
              {{ t("login_tip_power_latch") }}
            </div>
          </div>
          <button class="cp-login__ghost" type="button" @click="$router.push('/servers')">{{ t("login_open_server_manager") }}</button>
          <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">{{ t("login_open_plugin_center") }}</button>
        </div>
      </section>

      <section class="cp-login__right">
        <div class="cp-login__panel">
          <div class="cp-login__panelTitle">{{ t("register_create_account") }}</div>
          <div class="cp-login__panelSub">{{ t("register_create_account_desc") }}</div>

          <div class="cp-login__methodTabs" role="tablist">
            <button
              class="cp-login__methodTab"
              type="button"
              role="tab"
              :aria-selected="authMethod === 'password'"
              :data-active="authMethod === 'password'"
              @click="switchAuthMethod('password')"
            >
              {{ t("login_method_password") }}
            </button>
            <button
              class="cp-login__methodTab"
              type="button"
              role="tab"
              :aria-selected="authMethod === 'email'"
              :data-active="authMethod === 'email'"
              @click="switchAuthMethod('email')"
            >
              {{ t("login_method_email") }}
            </button>
          </div>

          <div v-if="authMethod === 'email' ? emailBanner : passwordBanner" class="cp-login__banner">
            {{ authMethod === "email" ? emailBanner : passwordBanner }}
          </div>

          <div v-if="authMethod === 'password'" class="cp-login__form">
            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">{{ t("login_field_username") }}</div>
              <t-input v-model="username" :placeholder="t('login_username_placeholder')" clearable />
            </div>

            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">{{ t("login_field_password") }}</div>
              <t-input v-model="password" type="password" :placeholder="t('login_password_placeholder')" clearable />
            </div>

            <button class="cp-login__primary" type="button" :disabled="passwordLoggingIn" @click="handlePasswordAuth">
              {{ passwordLoggingIn ? t("register_creating") : t("register_create_account") }}
            </button>

            <div class="cp-login__formRow" style="margin-top: 8px; text-align: center;">
              <span style="font-size: 12px; color: var(--cp-text-muted);">{{ t("register_already_have") }}</span>
              <button class="cp-login__ghost" type="button" @click="$router.push('/login')" style="margin-top: 6px;">
                {{ t("register_sign_in") }}
              </button>
            </div>

            <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">{{ t("login_open_plugin_center") }}</button>
          </div>

          <div v-else class="cp-login__form">
            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">{{ t("login_field_email") }}</div>
              <t-input v-model="email" :placeholder="t('login_email_placeholder')" clearable />
            </div>

            <div class="cp-login__formRow">
              <div class="cp-login__fieldLabel">{{ t("login_code") }}</div>
              <div class="cp-login__codeRow">
                <t-input v-model="code" :placeholder="t('login_code_placeholder')" clearable />
                <button
                  class="cp-login__sendBtn"
                  type="button"
                  :disabled="sending || countdown > 0"
                  @click="handleSendCode"
                >
                  {{ countdown > 0 ? t("resend_in", { n: countdown }) : sending ? t("sending") : t("send_code") }}
                </button>
              </div>
            </div>

            <button class="cp-login__primary" type="button" :disabled="emailLoggingIn" @click="handleLogin">
              {{ emailLoggingIn ? t("register_creating") : t("register_create_account") }}
            </button>

            <div class="cp-login__formRow" style="margin-top: 8px; text-align: center;">
              <span style="font-size: 12px; color: var(--cp-text-muted);">{{ t("register_already_have") }}</span>
              <button class="cp-login__ghost" type="button" @click="$router.push('/login')" style="margin-top: 6px;">
                {{ t("register_sign_in") }}
              </button>
            </div>

            <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">{{ t("login_open_plugin_center") }}</button>
          </div>
        </div>
      </section>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* RegisterPage styles — reuses LoginPage CSS via same class names */
/* 样式：RegisterPage｜规格：左右两栏一级玻璃面板 + 内嵌卡片 */
.cp-login {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 460px);
  gap: var(--cp-page-gap);
  padding: var(--cp-page-pad);
}

/* 左右两栏各自为一级玻璃面板 */
.cp-login__left,
.cp-login__right {
  @include cp-glass-panel;

  overflow: hidden;
  min-width: 0;
}

.cp-login__left {
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.cp-login__leftHead {
  padding: 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.cp-login__brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cp-login__brandMark {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  border: 1px solid var(--cp-highlight-border);
  background:
    radial-gradient(10px 10px at 30% 35%, color-mix(in oklab, var(--cp-accent) 86%, transparent), transparent 60%),
    radial-gradient(12px 12px at 68% 60%, color-mix(in oklab, var(--cp-accent-2) 84%, transparent), transparent 60%),
    color-mix(in oklab, var(--cp-panel-solid) 72%, var(--cp-bg));
  box-shadow: var(--cp-elev-1, var(--cp-shadow-soft));
}

.cp-login__brandName {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 16px;
  color: var(--cp-text);
}

.cp-login__brandSub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 阶段指示：握手 → 认证；当前阶段用 accent（连接进程） */
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

.cp-login__stageItem {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-login__stageItem[data-active="true"] {
  color: var(--cp-accent);
}

.cp-login__stageSep {
  opacity: 0.55;
}

.cp-login__rack {
  padding: 14px;
  overflow: auto;
}

/* 机架概览微标签（本地化文案，不做大写变换） */
.cp-login__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-login__field {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Field label：普通字段标签（用户内容不做大写变换） */
.cp-login__fieldLabel {
  margin-bottom: 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-login__fieldHint {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Mini connect button：连接动作使用 accent 语义 */
.cp-login__miniBtn {
  @include cp-pill-button;

  border-color: color-mix(in oklab, var(--cp-accent) 40%, var(--cp-border));
  background: var(--cp-accent-soft);
  color: var(--cp-text);
}

.cp-login__miniBtn:hover {
  border-color: color-mix(in oklab, var(--cp-accent) 58%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 20%, transparent);
}

/* 分段控件：使用统一 mixin */
.cp-login__seg {
  @include cp-segmented;
}

.cp-login__segBtn {
  @include cp-segmented-item;
}

.cp-login__transportHint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-login__leftFoot {
  border-top: 1px solid var(--cp-border-light);
  padding: 14px;
}

/* 提示块：内嵌卡片（虚化底） */
.cp-login__monoBlock {
  @include cp-card;

  border-style: dashed;
  background: var(--cp-panel-muted);
  padding: 12px;
}

/* 提示标题（本地化文案，不做大写变换） */
.cp-login__monoTitle {
  font-size: 12px;
  font-weight: 600;
  color: var(--cp-text-muted);
}

.cp-login__monoText {
  margin-top: 8px;
  font-size: 12px;
  color: var(--cp-text-muted);
  line-height: 1.45;
}

.cp-login__right {
  display: grid;
  place-items: center;
  padding: 14px;
}

/* 注册面板：内嵌卡片，不再叠加一层玻璃/阴影 */
.cp-login__panel {
  @include cp-card;

  width: min(440px, 100%);
  padding: 16px;
}

.cp-login__panelTitle {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-login__panelSub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* 反馈条：校验提示 / 验证码已发送 */
.cp-login__banner {
  @include cp-inline-status(info);

  margin-top: 12px;
}

.cp-login__form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 注册方式分段控件：2 等分 */
.cp-login__methodTabs {
  @include cp-segmented;

  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 4px 0 10px;
}

.cp-login__methodTab {
  @include cp-segmented-item;

  text-align: center;
}

.cp-login__codeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

/* Send code button */
.cp-login__sendBtn {
  @include cp-pill-button;

  height: var(--cp-field-height);
  min-width: 128px;
  white-space: nowrap;
}

/* Primary create-account button：主操作使用 highlight 语义 */
.cp-login__primary {
  @include cp-pill-button(primary);

  min-height: var(--cp-field-height);
  font-size: 13px;
  font-weight: 600;
}

/* Ghost navigation button */
.cp-login__ghost {
  @include cp-pill-button;

  color: var(--cp-text-muted);
}

.cp-login__miniBtn:focus-visible,
.cp-login__segBtn:focus-visible,
.cp-login__sendBtn:focus-visible,
.cp-login__primary:focus-visible,
.cp-login__ghost:focus-visible {
  outline: 2px solid var(--cp-highlight-border-strong);
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

@media (max-width: 640px) {
  .cp-login {
    gap: var(--cp-page-gap);
    padding: 10px;
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
