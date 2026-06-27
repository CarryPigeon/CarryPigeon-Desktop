<script setup lang="ts">
/**
 * @fileoverview RegisterPage.vue
 * @description account/auth-flow｜页面：RegisterPage。
 */

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
import { useLoginHotkeys } from "@/features/account/auth-flow/presentation/composables/useLoginHotkeys";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";

const router = useRouter();
const { t } = useI18n();

const { email, code, sending, loggingIn, banner, countdown, clearBanner, handleSendCode, handleLogin } = useLoginEmailAuth({
  router,
  mode: "register",
});

const { transport, socketDraft, stage, serverInfo, handleConnect } = useLoginConnection({
  onSocketDraftChanged: clearBanner,
});

useLoginHotkeys(router);
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
              {{ t("login_server_id_hint") }}
            </div>
          </div>
        </div>

        <div class="cp-login__leftFoot">
          <div class="cp-login__monoBlock">
            <div class="cp-login__monoTitle">Tip</div>
            <div class="cp-login__monoText">
              {{ t("login_tip_power_latch") }}
            </div>
          </div>
          <button class="cp-login__ghost" type="button" @click="$router.push('/servers')">Open Server Manager</button>
          <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">Open Plugin Center</button>
        </div>
      </section>

      <section class="cp-login__right">
        <div class="cp-login__panel">
          <div class="cp-login__panelTitle">Create Account</div>
          <div class="cp-login__panelSub">Create a new account on this server</div>

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
              {{ loggingIn ? "Creating account…" : "Create Account" }}
            </button>

            <div class="cp-login__formRow" style="margin-top: 8px; text-align: center;">
              <span style="font-size: 12px; color: var(--cp-text-muted);">Already have an account?</span>
              <button class="cp-login__ghost" type="button" @click="$router.push('/login')" style="margin-top: 6px;">
                Sign in
              </button>
            </div>

            <button class="cp-login__ghost" type="button" @click="$router.push('/plugins')">Open Plugin Center</button>
          </div>
        </div>
      </section>
    </ErrorBoundary>
  </main>
</template>

<style scoped lang="scss">
/* RegisterPage styles — reuses LoginPage CSS via same class names */
.cp-login {
  height: 100%;
  display: grid;
  grid-template-columns: 1fr minmax(360px, 460px);
  gap: 14px;
  padding: 14px;
}

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
    radial-gradient(10px 10px at 30% 35%, color-mix(in oklab, var(--cp-highlight) 86%, transparent), transparent 60%),
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
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-login__stageItem[data-active="true"] {
  color: var(--cp-text);
}

.cp-login__stageSep {
  opacity: 0.55;
}

.cp-login__rack {
  padding: 14px;
  overflow: auto;
}

.cp-login__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-login__field {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-login__fieldLabel {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 8px;
}

.cp-login__fieldHint {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

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

.cp-login__miniBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg-strong);
}

.cp-login__miniBtn:active {
  transform: translateY(0);
}

.cp-login__seg {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

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

.cp-login__segBtn:hover {
  transform: translateY(-1px);
  border-color: var(--cp-highlight-border);
  background: var(--cp-hover-bg);
}

.cp-login__segBtn:active {
  transform: translateY(0);
}

.cp-login__segBtn[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
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

.cp-login__monoBlock {
  border: 1px dashed rgba(148, 163, 184, 0.22);
  background: var(--cp-panel-muted);
  border-radius: 18px;
  padding: 12px;
}

.cp-login__monoTitle {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 11px;
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

.cp-login__panel {
  width: min(440px, 100%);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
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

.cp-login__banner {
  margin-top: 12px;
  border: 1px dashed var(--cp-highlight-border);
  background: var(--cp-highlight-bg);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-login__form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-login__codeRow {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
}

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

.cp-login__sendBtn:hover:enabled {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-login__sendBtn:active:enabled {
  transform: translateY(0);
}

.cp-login__sendBtn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

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

.cp-login__primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

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
